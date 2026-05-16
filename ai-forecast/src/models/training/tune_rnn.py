"""Grid search for GRU hyperparameters.

Searches over hidden_size, num_layers, learning_rate, and lookback,
training a model for each configuration and tracking validation loss.
"""

import itertools
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn

from src.config.settings import settings
from src.data.pipelines.make_train_dataset import make_train_dataset
from src.models.training.train_rnn import (
    _build_gru_regressor,
    _create_sequences,
    _get_feature_columns,
)

_SEARCH_SPACE = {
    "hidden_size": [32, 64, 128],
    "num_layers": [1, 2],
    "learning_rate": [1e-4, 5e-4, 1e-3],
    "lookback": [12, 24],
}


def _train_single_config(
    x_train: torch.Tensor,
    y_train: torch.Tensor,
    x_val: torch.Tensor,
    y_val: torch.Tensor,
    input_size: int,
    config: dict[str, Any],
    max_epochs: int = 50,
) -> tuple[float, dict]:
    """Train a single GRU configuration and return the best validation loss."""
    gru, head = _build_gru_regressor(
        input_size=input_size,
        hidden_size=config["hidden_size"],
        num_layers=config["num_layers"],
        dropout=0.2,
    )
    optimizer = torch.optim.Adam(
        list(gru.parameters()) + list(head.parameters()),
        lr=config["learning_rate"],
    )
    loss_fn = nn.MSELoss()

    best_val_loss = float("inf")
    best_state = None
    patience = 5
    no_improve = 0

    for _ in range(max_epochs):
        gru.train()
        head.train()
        optimizer.zero_grad()
        out, _ = gru(x_train)
        pred = head(out[:, -1, :])
        loss = loss_fn(pred, y_train)
        loss.backward()
        nn.utils.clip_grad_norm_(
            list(gru.parameters()) + list(head.parameters()), max_norm=1.0
        )
        optimizer.step()

        gru.eval()
        head.eval()
        with torch.no_grad():
            val_out, _ = gru(x_val)
            val_pred = head(val_out[:, -1, :])
            val_loss = float(loss_fn(val_pred, y_val).item())

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {
                "gru": {k: v.clone() for k, v in gru.state_dict().items()},
                "head": {k: v.clone() for k, v in head.state_dict().items()},
            }
            no_improve = 0
        else:
            no_improve += 1
            if no_improve >= patience:
                break

    return best_val_loss, best_state


def hyperparameter_search(
    search_space: dict | None = None,
) -> list[dict]:
    """Run grid search over the specified hyperparameter space.

    Returns a list of results sorted by validation loss (best first).
    """
    space = search_space or _SEARCH_SPACE
    keys = list(space.keys())
    combos = list(itertools.product(*(space[k] for k in keys)))

    df = make_train_dataset(hours=720)
    if df.empty or "humidity" not in df.columns:
        return [{"status": "skipped", "message": "No training data available."}]

    feature_columns = _get_feature_columns(df)
    feature_data = df[feature_columns].astype(float).values
    target_data = df["humidity"].astype(float).values
    humidity_idx = feature_columns.index("humidity")

    min_vals = feature_data.min(axis=0)
    max_vals = feature_data.max(axis=0)
    ranges = max_vals - min_vals
    ranges[ranges == 0] = 1.0

    input_size = len(feature_columns)
    results = []

    for combo in combos:
        config = dict(zip(keys, combo))
        lookback = config.get("lookback", 24)

        norm_features = (feature_data - min_vals) / ranges
        norm_target = (target_data - min_vals[humidity_idx]) / ranges[humidity_idx]
        x, y = _create_sequences(norm_features, norm_target, lookback=lookback)
        if x is None or y is None:
            continue

        split = int(x.size(0) * 0.8)
        if split < lookback or x.size(0) - split < lookback:
            continue

        x_train, x_val = x[:split], x[split:]
        y_train, y_val = y[:split], y[split:]

        val_loss, _ = _train_single_config(
            x_train, y_train, x_val, y_val, input_size, config
        )

        results.append(
            {
                **config,
                "val_loss": round(val_loss, 6),
                "input_size": input_size,
            }
        )

    results.sort(key=lambda r: r["val_loss"])

    return results
