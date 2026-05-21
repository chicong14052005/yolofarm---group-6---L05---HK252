"""Training loop for HumidityGRU."""

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from src.config import settings
from src.model.gru import HumidityGRU


def train_model(
    X: torch.Tensor,
    y: torch.Tensor,
    val_split: float = 0.2,
) -> HumidityGRU:
    """Train the GRU model on pre-built sequences.

    Parameters
    ----------
    X : (n, lookback, 1)
    y : (n,)
    val_split : fraction of data to hold out for validation

    Returns
    -------
    trained HumidityGRU model
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Temporal split (no shuffle — time series)
    split = int(len(X) * (1 - val_split))
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    train_loader = DataLoader(
        TensorDataset(X_train, y_train),
        batch_size=64,
        shuffle=False,
    )
    val_loader = DataLoader(
        TensorDataset(X_val, y_val),
        batch_size=64,
        shuffle=False,
    )

    model = HumidityGRU(
        input_size=1,
        hidden_size=settings.hidden_size,
        num_layers=settings.num_layers,
        dropout=settings.dropout,
    ).to(device)

    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=settings.learning_rate)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5
    )

    best_val_loss = float("inf")
    patience_counter = 0
    best_state = None

    for epoch in range(settings.max_epochs):
        model.train()
        train_loss = 0.0
        for Xb, yb in train_loader:
            Xb, yb = Xb.to(device), yb.to(device)
            optimizer.zero_grad()
            loss = criterion(model(Xb), yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item() * Xb.size(0)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for Xb, yb in val_loader:
                Xb, yb = Xb.to(device), yb.to(device)
                loss = criterion(model(Xb), yb)
                val_loss += loss.item() * Xb.size(0)

        train_loss /= len(X_train)
        val_loss /= len(X_val)

        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= settings.early_stopping_patience:
                break

    model.load_state_dict(best_state)
    model.eval()
    return model


def save_model(model: HumidityGRU, path: str, metadata: dict) -> None:
    """Persist model weights + metadata to disk."""
    artifact = {
        "framework": "pytorch",
        "architecture": "HumidityGRU",
        "input_size": 1,
        "hidden_size": settings.hidden_size,
        "num_layers": settings.num_layers,
        "lookback": metadata["lookback"],
        "dropout": settings.dropout,
        "vmin": metadata["vmin"],
        "vmax": metadata["vmax"],
        "state_dict": model.state_dict(),
        **metadata,
    }
    torch.save(artifact, path)


def load_model(path: str) -> dict:
    """Load model artifact from disk."""
    return torch.load(path, map_location="cpu", weights_only=False)
