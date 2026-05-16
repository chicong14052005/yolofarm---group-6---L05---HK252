from dataclasses import dataclass

import pandas as pd


@dataclass
class MinMaxState:
    min_value: float
    max_value: float


def fit_minmax(series: pd.Series) -> MinMaxState:
    return MinMaxState(min_value=float(series.min()), max_value=float(series.max()))


def apply_minmax(series: pd.Series, state: MinMaxState) -> pd.Series:
    if state.max_value == state.min_value:
        return series * 0.0
    return (series - state.min_value) / (state.max_value - state.min_value)
