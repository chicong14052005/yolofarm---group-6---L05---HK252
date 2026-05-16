#!/usr/bin/env sh
set -e
python -c "from src.models.training.train_rnn import train_gru_baseline; print(train_gru_baseline())"
