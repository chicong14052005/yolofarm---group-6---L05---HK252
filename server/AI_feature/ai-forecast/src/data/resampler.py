"""Gap detection and resampling for irregularly-spaced sensor data."""

import numpy as np
import pandas as pd

# Standard intervals in minutes that we can round to
STANDARD_INTERVALS_MIN = [1, 5, 10, 15, 30, 60]


def analyze_gaps(df: pd.DataFrame) -> dict:
    """Analyze time gaps between consecutive records.

    Parameters
    ----------
    df : DataFrame with columns [recorded_at, value], pre-sorted ascending.

    Returns
    -------
    dict with keys: intervals_s, median_interval_s, min_interval_s,
                    max_interval_s, gaps_above_2x, total_gaps, coverage_pct,
                    recommended_interval_min
    """
    if len(df) < 2:
        return {
            "intervals_s": [],
            "median_interval_s": 0,
            "min_interval_s": 0,
            "max_interval_s": 0,
            "gaps_above_2x": 0,
            "total_gaps": 0,
            "coverage_pct": 0.0,
            "recommended_interval_min": 15,
            "n_records": len(df),
        }

    deltas = df["recorded_at"].diff().dt.total_seconds().iloc[1:]
    intervals_s = deltas.tolist()
    median_s = float(deltas.median()) if not deltas.empty else 0.0
    min_s = float(deltas.min()) if not deltas.empty else 0.0
    max_s = float(deltas.max()) if not deltas.empty else 0.0

    threshold_2x = median_s * 2
    gaps_above_2x = int((deltas > threshold_2x).sum())

    # Coverage: how much of the total span is actually covered by data
    total_span_s = (df["recorded_at"].iloc[-1] - df["recorded_at"].iloc[0]).total_seconds()
    sum_intervals_within_2x = deltas[deltas <= threshold_2x].sum()
    coverage_pct = (sum_intervals_within_2x / total_span_s * 100) if total_span_s > 0 else 0.0

    # Pick nearest standard interval
    median_min = median_s / 60.0
    recommended = min(STANDARD_INTERVALS_MIN, key=lambda x: abs(x - median_min))

    return {
        "intervals_s": intervals_s,
        "median_interval_s": round(median_s, 1),
        "min_interval_s": round(min_s, 1),
        "max_interval_s": round(max_s, 1),
        "gaps_above_2x": gaps_above_2x,
        "total_gaps": len(deltas),
        "coverage_pct": round(coverage_pct, 1),
        "recommended_interval_min": recommended,
        "n_records": len(df),
    }


def resample_to_interval(
    df: pd.DataFrame,
    interval_minutes: int | None = None,
    max_gap_multiplier: float = 2.0,
) -> pd.DataFrame:
    """Resample humidity data to a fixed interval.

    Parameters
    ----------
    df : DataFrame with columns [recorded_at, value], pre-sorted ascending.
    interval_minutes : Target interval. Auto-detected from median if None.
    max_gap_multiplier : Gaps larger than this * interval are treated as
                         sequence breaks (filled with NaN).

    Returns
    -------
    DataFrame with columns [recorded_at, value], resampled to fixed interval.
    Gaps smaller than max_gap_multiplier * interval are forward-filled.
    Large gaps are left as NaN (sequence boundary markers).
    """
    if df.empty:
        return df

    if interval_minutes is None:
        gap_info = analyze_gaps(df)
        interval_minutes = gap_info["recommended_interval_min"]

    interval_str = f"{interval_minutes}min"

    # Set index and resample
    ts = df.copy()
    ts = ts.set_index("recorded_at")
    ts = ts.resample(interval_str).mean()

    # Forward-fill small gaps (up to max_gap_multiplier * interval)
    max_gap_steps = int(max_gap_multiplier)
    ts["value"] = ts["value"].ffill(limit=max_gap_steps)

    # Drop rows that remain NaN (large gaps)
    ts = ts.dropna(subset=["value"])

    ts = ts.reset_index()
    return ts


def split_at_large_gaps(
    df: pd.DataFrame,
    interval_minutes: int,
    max_gap_multiplier: float = 2.0,
) -> list[pd.DataFrame]:
    """Split a resampled DataFrame into contiguous sequences at large gaps.

    Returns a list of DataFrames, each with no gaps > max_gap_multiplier * interval.
    """
    if df.empty:
        return []

    max_allowed_s = max_gap_multiplier * interval_minutes * 60
    sequences = []
    start_idx = 0

    for i in range(1, len(df)):
        gap = (df["recorded_at"].iloc[i] - df["recorded_at"].iloc[i - 1]).total_seconds()
        if gap > max_allowed_s:
            sequences.append(df.iloc[start_idx:i].reset_index(drop=True))
            start_idx = i

    sequences.append(df.iloc[start_idx:].reset_index(drop=True))
    return [s for s in sequences if len(s) > 1]
