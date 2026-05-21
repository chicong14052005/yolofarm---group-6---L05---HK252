"""Simple GRU model for univariate time-series forecasting."""

import torch
import torch.nn as nn


class HumidityGRU(nn.Module):
    """GRU that takes (lookback_steps, 1) and predicts next value."""

    def __init__(
        self,
        input_size: int = 1,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )
        self.dropout = nn.Dropout(dropout)
        self.head = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (batch, lookback, 1) -> out: (batch, 1)"""
        _, h_n = self.gru(x)
        out = h_n[-1]
        out = self.dropout(out)
        out = self.head(out)
        return out.squeeze(-1)

    @torch.no_grad()
    def predict_mc(self, x: torch.Tensor, n_samples: int = 50) -> tuple[torch.Tensor, torch.Tensor]:
        """Monte Carlo Dropout inference.

        Returns (mean, std) over n_samples forward passes.
        """
        self.train()  # keep dropout active
        preds = torch.stack([self.forward(x) for _ in range(n_samples)])
        self.eval()
        return preds.mean(dim=0), preds.std(dim=0)
