"""Build (lookback, 1) sequences from resampled time series data."""

import numpy as np
import torch


def minmax_fit(values: np.ndarray):
    """Compute min/max for normalization."""
    vmin = values.min()
    vmax = values.max()
    if vmax - vmin < 1e-8:
        vmax = vmin + 1.0
    return float(vmin), float(vmax)


def minmax_norm(values: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    """Apply min-max normalization."""
    return (values - vmin) / (vmax - vmin)


def minmax_denorm(values, vmin: float, vmax: float) -> np.ndarray:
    """Reverse min-max normalization."""
    return values * (vmax - vmin) + vmin


def create_sequences(
    values: np.ndarray,
    lookback: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Create (X, y) sliding-window sequences.

    X shape: (n_sequences, lookback, 1)
    y shape: (n_sequences,)
    """
    X, y = [], []
    for i in range(lookback, len(values)):
        X.append(values[i - lookback : i])
        y.append(values[i])
    if len(X) == 0:
        return np.empty((0, lookback, 1), dtype=np.float32), np.empty(0, dtype=np.float32)
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)
    X = X.reshape(X.shape[0], X.shape[1], 1)
    return X, y


def build_training_data(
    df_sequences: list,
    lookback: int,
) -> tuple[torch.Tensor, torch.Tensor, float, float]:
    """Build normalized training tensors from resampled sequences.

    Parameters
    ----------
    df_sequences : list of DataFrames (contiguous blocks after gap-splitting)
    lookback : number of past steps to use for prediction

    Returns
    -------
    (X_tensor, y_tensor, vmin, vmax)
    """
    all_values = np.concatenate([df["value"].values for df in df_sequences])
    vmin, vmax = minmax_fit(all_values)

    X_list, y_list = [], []
    for df_seq in df_sequences:
        vals = minmax_norm(df_seq["value"].values, vmin, vmax)
        Xs, ys = create_sequences(vals, lookback)
        if len(Xs) > 0:
            X_list.append(Xs)
            y_list.append(ys)

    if not X_list:
        return torch.empty(0, lookback, 1), torch.empty(0), vmin, vmax

    X_all = np.concatenate(X_list, axis=0)
    y_all = np.concatenate(y_list, axis=0)

    return (
        torch.from_numpy(X_all),
        torch.from_numpy(y_all),
        vmin,
        vmax,
    )
