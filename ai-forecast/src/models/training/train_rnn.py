from pathlib import Path

import numpy as np
import torch
from torch import nn

from src.config.settings import settings
from src.data.pipelines.make_train_dataset import make_train_dataset


def _build_gru_regressor(
    input_size: int, hidden_size: int, num_layers: int, dropout: float = 0.0
):
    gru = nn.GRU(
        input_size=input_size,
        hidden_size=hidden_size,
        num_layers=num_layers,
        dropout=dropout if num_layers > 1 else 0.0,
        batch_first=True,
    )
    head = nn.Sequential(
        nn.Dropout(p=dropout),
        nn.Linear(hidden_size, 1),
    )
    return gru, head


def _get_feature_columns(df):
    exclude = {"recorded_at", "pipeline_version"}
    return [c for c in df.columns if c not in exclude]


def _create_sequences(features: np.ndarray, target: np.ndarray, lookback: int = 24):
    if len(target) <= lookback:
        return None, None

    xs = []
    ys = []
    for idx in range(lookback, len(target)):
        xs.append(features[idx - lookback : idx])
        ys.append(target[idx])

    x = torch.from_numpy(np.stack(xs)).float()
    y = torch.from_numpy(np.stack(ys)).float().unsqueeze(-1)
    return x, y


def train_gru_baseline() -> dict:
    df = make_train_dataset(hours=720)
    if df.empty or "humidity" not in df.columns:
        return {
            "status": "skipped",
            "message": "No training data available from source connector.",
        }

    feature_columns = _get_feature_columns(df)
    feature_data = df[feature_columns].astype(float).values  # (N, num_features)
    target_data = df["humidity"].astype(float).values  # (N,)

    humidity_idx = feature_columns.index("humidity")

    # Per-feature min-max normalization
    min_vals = feature_data.min(axis=0)
    max_vals = feature_data.max(axis=0)
    ranges = max_vals - min_vals
    ranges[ranges == 0] = 1.0

    normalized_features = (feature_data - min_vals) / ranges
    normalized_target = (target_data - min_vals[humidity_idx]) / ranges[humidity_idx]

    x, y = _create_sequences(normalized_features, normalized_target, lookback=24)
    if x is None or y is None:
        return {
            "status": "skipped",
            "message": "Not enough data points to build sequences.",
        }

    # Temporal 80/20 split: last 20% of sequences for validation
    split = int(x.size(0) * 0.8)
    x_train, x_val = x[:split], x[split:]
    y_train, y_val = y[:split], y[split:]

    if x_val.size(0) == 0:
        # Fall back to full training set if too few samples
        x_val, y_val = x_train, y_train

    input_size = len(feature_columns)
    hidden_size = int(getattr(settings, "hidden_size", 64))
    num_layers = int(getattr(settings, "num_layers", 2))
    lookback = int(getattr(settings, "lookback", 24))
    learning_rate = float(getattr(settings, "learning_rate", 1e-3))
    max_epochs = int(getattr(settings, "max_epochs", 100))
    patience = int(getattr(settings, "early_stopping_patience", 10))
    dropout = float(getattr(settings, "dropout", 0.2))

    gru, head = _build_gru_regressor(
        input_size=input_size,
        hidden_size=hidden_size,
        num_layers=num_layers,
        dropout=dropout,
    )
    optimizer = torch.optim.Adam(
        list(gru.parameters()) + list(head.parameters()), lr=learning_rate
    )
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5
    )
    loss_fn = nn.MSELoss()

    best_val_loss = float("inf")
    best_state = None
    epochs_without_improvement = 0
    final_train_loss = None

    for epoch in range(max_epochs):
        gru.train()
        head.train()
        optimizer.zero_grad()
        out_train, _ = gru(x_train)
        pred_train = head(out_train[:, -1, :])
        loss_train = loss_fn(pred_train, y_train)
        loss_train.backward()
        nn.utils.clip_grad_norm_(
            list(gru.parameters()) + list(head.parameters()), max_norm=1.0
        )
        optimizer.step()

        # Validation
        gru.eval()
        head.eval()
        with torch.no_grad():
            out_val, _ = gru(x_val)
            pred_val = head(out_val[:, -1, :])
            loss_val = loss_fn(pred_val, y_val)
        val_loss = float(loss_val.item())

        if epoch == max_epochs - 1:
            final_train_loss = float(loss_train.item())

        scheduler.step(val_loss)

        # Early stopping check
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {
                "gru": {k: v.clone() for k, v in gru.state_dict().items()},
                "head": {k: v.clone() for k, v in head.state_dict().items()},
            }
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= patience:
                break

    model_path = Path(settings.model_path)
    model_path.parent.mkdir(parents=True, exist_ok=True)

    # Restore best weights
    if best_state is not None:
        gru.load_state_dict(best_state["gru"])
        head.load_state_dict(best_state["head"])

    torch.save(
        {
            "framework": "pytorch",
            "architecture": "nn.GRU + nn.Sequential(Dropout, Linear)",
            "gru_state_dict": gru.state_dict(),
            "head_state_dict": head.state_dict(),
            "input_size": input_size,
            "hidden_size": hidden_size,
            "num_layers": num_layers,
            "lookback": lookback,
            "dropout": dropout,
            "feature_columns": feature_columns,
            "min_vals": min_vals.tolist(),
            "max_vals": max_vals.tolist(),
            "humidity_idx": humidity_idx,
            "pipeline_version": "v1",
            "train_loss": final_train_loss,
            "val_loss": best_val_loss,
            "epochs_trained": epoch + 1,
        },
        model_path,
    )

    return {
        "status": "trained",
        "model": "gru",
        "artifact": str(model_path),
        "samples": int(x.size(0)),
        "features": len(feature_columns),
        "train_loss": round(final_train_loss, 6) if final_train_loss else None,
        "val_loss": round(best_val_loss, 6),
        "epochs_trained": epoch + 1,
        "early_stopped": epochs_without_improvement >= patience,
    }
