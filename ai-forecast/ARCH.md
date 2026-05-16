# AI Forecast System Architecture

## 1. System Context

```mermaid
graph TB
    subgraph "IoT Layer"
        SENSORS["Humidity / Temp / Soil / Light Sensors"]
        MQTT["Adafruit IO MQTT"]
    end

    subgraph "Node.js Backend (Express)"
        MQTT_SVC["mqttService.js"]
        WEATHER_SVC["weatherService.js"]
        AI_FORECAST_SVC["aiForecastService.js"]
        ALERT_SVC["processForecastAlerts()"]
        SOCKET["Socket.IO"]
        AI_CTRL["aiController.js"]
    end

    subgraph "Python AI Service (FastAPI)"
        FORECAST_API["/forecast/humidity"]
        TRAIN_API["/train/humidity"]
        EVAL_API["/evaluate/run"]
        DRIFT_API["/drift/latest"]
        DISEASE_API["/detect-disease"]
    end

    subgraph "ML Pipeline"
        FEATURE_ENG["Feature Engineering
                     14 features: humidity, temp,
                     soil_moisture, light, lags,
                     rolling stats, time features"]
        GRU["GRU v2
             2-layer GRU
             Hidden=64, Dropout=0.2
             Multivariate input"]
        MC_DROPOUT["MC Dropout
                    50 forward passes
                    95% Confidence Interval"]
        BASELINES["Baseline Models
                   Persistence / Seasonal Naive
                   Linear Regression"]
    end

    subgraph "Training Pipeline"
        TRAIN_DATA["make_train_dataset()
                    720h sensor history"]
        VAL_SPLIT["Temporal 80/20 split"]
        TRAIN_LOOP["Early Stopping (patience=10)
                    ReduceLROnPlateau
                    Gradient Clipping"]
        ARTIFACT["Model Artifact
                  gru_latest.pt"]
        HPARAM_SEARCH["Hyperparameter Search
                       Grid: hidden_size, num_layers,
                       lr, lookback"]
    end

    subgraph "Databases"
        MYSQL[("MySQL
               sensor_data
               settings
               users")]
        TIMESCALE[("TimescaleDB
                    humidity_forecasts
                    forecast_evaluations
                    drift_metrics
                    model_registry
                    training_runs")]
    end

    subgraph "Frontend (React)"
        CHART["ChartCarousel.tsx
              EnvironmentChart.tsx"]
        AI_PAGE["AIPage.tsx
                Disease Detection UI"]
    end

    subgraph "Evaluation & Monitoring"
        EVAL["evaluator.py
              MAE / RMSE / MAPE"]
        DRIFT["drift_monitor.py
              PSI, error ratio,
              coverage drift"]
    end

    SENSORS --> MQTT
    MQTT --> MQTT_SVC
    WEATHER_SVC --> MQTT
    MQTT_SVC --> MYSQL
    MYSQL --> TRAIN_DATA
    MYSQL --> FEATURE_ENG
    MYSQL --> EVAL

    TRAIN_DATA --> VAL_SPLIT
    VAL_SPLIT --> TRAIN_LOOP
    HPARAM_SEARCH --> TRAIN_LOOP
    TRAIN_LOOP --> ARTIFACT

    ARTIFACT --> GRU
    FEATURE_ENG --> GRU
    GRU --> MC_DROPOUT
    BASELINES --> FORECAST_API

    FORECAST_API --> AI_FORECAST_SVC
    TRAIN_API --> TRAIN_LOOP
    EVAL_API --> EVAL
    DRIFT_API --> DRIFT

    MC_DROPOUT --> TIMESCALE
    EVAL --> TIMESCALE
    DRIFT --> TIMESCALE

    AI_FORECAST_SVC --> ALERT_SVC
    ALERT_SVC --> SOCKET
    SOCKET --> CHART

    AI_CTRL --> AI_FORECAST_SVC
    AI_CTRL --> DISEASE_API
    AI_PAGE --> AI_CTRL
    CHART --> AI_CTRL
```

## 2. Data Flow: Forecast Request

```mermaid
sequenceDiagram
    participant User
    participant Chart as ChartCarousel.tsx
    participant Node as Node.js Express
    participant Python as Python FastAPI
    participant MySQL
    participant TSDB as TimescaleDB

    Note over Chart: Auto-refreshes every 5 min
    Chart->>Node: POST /api/ai/forecast/humidity
    Note over Chart: history_hours=72, horizon_hours=24
    
    Node->>Python: POST /forecast/humidity
    Python->>MySQL: load_sensor_history(72h)
    MySQL-->>Python: raw sensor data
    
    Note over Python: Feature Engineering
    Note over Python: ffill → median fill → clip [0,100]
    Note over Python: Add lags (1/3/6/12/24), roll stats
    Note over Python: Add time features, covariates
    
    Python->>Python: Build 14-feature vector
    Python->>Python: Normalize per-feature
    
    alt Model artifact exists
        Python->>Python: MC Dropout inference (50 passes)
        Python->>Python: Compute 95% CI from std
    else Fallback
        Python->>Python: Linear decay
    end
    
    Python->>TSDB: Persist forecast rows
    Python-->>Node: ForecastResponse
    
    Node->>Node: processForecastAlerts()
    Node->>MySQL: Check alert thresholds
    MySQL-->>Node: threshold, min_confidence
    
    alt Threshold breached
        Node->>MySQL: Create ai_alert notifications
        Node->>Node: Socket.IO emit to all users
    end
    
    Node-->>Chart: forecast + alert_status
    Note over Chart: Render observed line + dashed forecast + confidence band
```

## 3. Model Architecture

```mermaid
graph LR
    subgraph "Input Layer (seq_len × 14)"
        H["humidity (t)"]
        T["temperature (t)"]
        SM["soil_moisture (t)"]
        L["light (t)"]
        LAG1["lag_1"]
        LAG3["lag_3"]
        LAG6["lag_6"]
        LAG12["lag_12"]
        LAG24["lag_24"]
        ROLL_M["roll_mean_6"]
        ROLL_S["roll_std_6"]
        HOUR["hour"]
        DOW["day_of_week"]
        WKEND["is_weekend"]
    end

    subgraph "GRU Encoder"
        GRU1["GRU Layer 1
              hidden_size=64"]
        GRU2["GRU Layer 2
              hidden_size=64
              dropout=0.2"]
    end

    subgraph "MC Dropout Inference (×50)"
        DROPOUT["Dropout(0.2)"]
        LINEAR["Linear(64, 1)"]
        AGG["Aggregate
            mean → prediction
            std  → uncertainty"]
    end

    subgraph "Output"
        VAL["predicted humidity (t+1)"]
        LOWER["lower_bound (95% CI)"]
        UPPER["upper_bound (95% CI)"]
        CONF["confidence score"]
    end

    H --> INPUT
    T --> INPUT
    SM --> INPUT
    L --> INPUT
    LAG1 --> INPUT
    LAG3 --> INPUT
    LAG6 --> INPUT
    LAG12 --> INPUT
    LAG24 --> INPUT
    ROLL_M --> INPUT
    ROLL_S --> INPUT
    HOUR --> INPUT
    DOW --> INPUT
    WKEND --> INPUT

    INPUT --> GRU1
    GRU1 --> GRU2
    GRU2 --> DROPOUT
    DROPOUT --> LINEAR
    LINEAR --> AGG
    AGG --> VAL
    AGG --> LOWER
    AGG --> UPPER
    AGG --> CONF

    style INPUT fill:#e1f5fe
    style GRU1 fill:#f3e5f5
    style GRU2 fill:#f3e5f5
    style AGG fill:#fff3e0
    style VAL fill:#e8f5e9
    style LOWER fill:#e8f5e9
    style UPPER fill:#e8f5e9
```

## 4. Training Pipeline

```mermaid
graph TB
    START["make_train_dataset(hours=720)"] --> MYSQL_LOAD["load_sensor_history()
                                                          MySQL → DataFrame"]
    MYSQL_LOAD --> PREPROCESS["preprocess()
                               1. Parse timestamps, sort ASC
                               2. Forward-fill + median-fill humidity
                               3. Clip humidity to [0, 100]
                               4. Add covariates (temp, soil, light)
                               5. Add time features (hour, dow, weekend)
                               6. Add lag features (1/3/6/12/24)
                               7. Add rolling stats (mean_6, std_6)
                               8. Drop NA → 14 features total"]

    PREPROCESS --> NORMALIZE["Per-feature min-max normalization"]
    NORMALIZE --> SEQUENCES["create_sequences(lookback=24)
                             X: (samples, 24, 14)
                             y: (samples, 1)"]

    SEQUENCES --> SPLIT{"Temporal Split"}

    SPLIT -->|"80%"| TRAIN_SET["Training set"]
    SPLIT -->|"20%"| VAL_SET["Validation set"]

    TRAIN_SET --> TRAIN_LOOP["Training Loop"]
    VAL_SET --> VAL_LOOP["Validation"]

    subgraph "Training Loop (max 100 epochs)"
        direction LR
        FWD["Forward pass
             GRU → Linear"] --> LOSS["MSELoss"]
        LOSS --> BCKWD["Backward pass"]
        BCKWD --> CLIP["Gradient Clipping
                        max_norm=1.0"]
        CLIP --> STEP["Optimizer step
                       Adam"]
        STEP --> VAL["Validation
                      (eval mode)"]
        VAL --> CHECK{"Val loss
                       improved?"}
        CHECK -->|"Yes"| SAVE["Save best weights
                               Reset patience"]
        CHECK -->|"No (10 epochs)"| STOP["Early Stop"]
    end

    TRAIN_LOOP --> SAVE_ARTIFACT["Save artifact
                                  gru_latest.pt
                                  state_dicts + metadata"]

    subgraph "Artifact Contents"
        WEIGHTS["GRU state dict
                 Head state dict"]
        PARAMS["input_size=14
                hidden_size=64
                num_layers=2
                lookback=24
                dropout=0.2"]
        NORM["feature_columns
              min_vals[]
              max_vals[]
              humidity_idx"]
        METRICS["train_loss
                 val_loss
                 epochs_trained"]
    end

    SAVE_ARTIFACT --> ARTIFACT_FILE["artifacts/models/gru_latest.pt"]

    style TRAIN_LOOP fill:#f3e5f5
    style VAL_LOOP fill:#fff3e0
    style SAVE_ARTIFACT fill:#e8f5e9
```

## 5. Feature Engineering Detail

```mermaid
graph LR
    RAW["Raw Sensor Data
         recorded_at
         humidity
         temperature
         soil_moisture
         light"] --> CLEAN["Data Cleaning
                            ffill → median fill
                            clip [0, 100]
                            sort by time"]

    CLEAN --> COV["Covariates
                   temperature
                   soil_moisture
                   light
                   (forward-filled at inference)"]

    CLEAN --> TIME["Time Features
                    hour (0-23)
                    day_of_week (0-6)
                    is_weekend (0/1)"]

    CLEAN --> LAG1["Lag Features
                    lag_1, lag_3, lag_6
                    lag_12, lag_24"]

    CLEAN --> ROLL["Rolling Stats
                    roll_mean_6
                    roll_std_6"]

    COV --> VEC["↓ Feature Vector
                 (14 dimensions per timestep)"]
    TIME --> VEC
    LAG1 --> VEC
    ROLL --> VEC
    CLEAN -->|"humidity"| VEC

    style VEC fill:#e1f5fe,stroke:#0288d1
```

## 6. API Route Map

```mermaid
graph TB
    root("/") --> health("GET /health")

    root --> forecast("prefix: /forecast")
    forecast --> fc_humidity("POST /humidity
                              Request: history_hours, horizon_hours, confidence
                              Response: predictions[], bounds, confidence")

    root --> train("prefix: /train")
    train --> tr_humidity("POST /humidity
                           Train GRU on latest 30 days")
    train --> tr_hpsearch("POST /hyperparameter-search
                           Grid: hidden, layers, lr, lookback")

    root --> models("prefix: /models")
    models --> md_latest("GET /latest
                          Current model metadata")

    root --> evaluate("prefix: /evaluate")
    evaluate --> ev_run("POST /run
                         Manual eval cycle")
    evaluate --> ev_latest("GET /latest
                            Latest metrics")

    root --> drift("prefix: /drift")
    drift --> dr_latest("GET /latest
                         Run drift checks")
    drift --> dr_status("GET /status
                         30-day history")

    root --> disease("prefix: /detect-disease")
    disease --> ds_detect("POST /detect-disease
                           Image upload → detection")

    style health fill:#e8f5e9
    style fc_humidity fill:#e3f2fd
    style tr_humidity fill:#fff3e0
    style ev_run fill:#f3e5f5
    style dr_latest fill:#fce4ec
```

## 7. Evaluation & Drift Monitoring

```mermaid
sequenceDiagram
    participant Cron as "Scheduler / Manual"
    participant Eval as "evaluator.py"
    participant MySQL
    participant TSDB as TimescaleDB
    participant Drift as "drift_monitor.py"

    Note over Cron: POST /evaluate/run
    Cron->>Eval: run_evaluation(lookback_hours=48)

    Eval->>TSDB: SELECT forecasts WHERE forecast_at < now - 1h
    Eval->>MySQL: SELECT actual sensor data
    MySQL-->>Eval: actual humidity values

    Note over Eval: Match forecasts to actuals by timestamp
    Note over Eval: Compute MAE, RMSE, MAPE, bias

    Eval->>TSDB: INSERT forecast_evaluations (per-point)
    Eval->>TSDB: INSERT drift_metrics (aggregate)

    Note over Cron: GET /drift/latest
    Cron->>Drift: run_drift_check()
    Drift->>TSDB: Load recent evaluations
    TSDB-->>Drift: errors, bounds, actuals

    Note over Drift: 1. Prediction Error Drift
    Note over Drift:    recent_MAE / baseline_MAE > 1.5?
    Note over Drift: 2. Coverage Drift
    Note over Drift:    empirical_coverage < 85%?
    Note over Drift: 3. Distribution Drift (PSI)

    Drift->>TSDB: INSERT drift_metrics (PSI, error_ratio, coverage)
    Drift-->>Cron: {drift_detected: bool, metrics: {...}}
```

## 8. Auto-Regressive Inference

```mermaid
graph TB
    HIST["History window
         last 24 rows of 14 features
         shape: (24, 14)"] --> NORM["Normalize using
                                     artifact min/max"]
    NORM --> GRU_IN["GRU Inference
                     MC Dropout ×50 passes
                     mean ± 1.96×std"]

    GRU_IN --> DENORM["Denormalize prediction"]
    DENORM --> PUSH["Append to predictions"]

    PUSH --> CHECK{"horizon reached?"}

    CHECK -->|"No → step k+1"| RECONSTRUCT["Reconstruct feature vector
                                             humidity = pred_{k-1}
                                             temp/sm/light = forward-fill
                                             lags = from history + predictions
                                             rolling = from window
                                             hour/dow = from forecast timestamp"]

    RECONSTRUCT --> NORM

    CHECK -->|"Yes"| DONE["Return predictions[1..horizon_hours]"]

    style HIST fill:#e1f5fe
    style GRU_IN fill:#f3e5f5
    style RECONSTRUCT fill:#fff3e0
    style DONE fill:#e8f5e9
```

## 9. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Model type** | GRU (not LSTM/Transformer) | Good balance of capacity and training speed for IoT sensor data |
| **Input features** | 14 features (multivariate) | Lag/rolling/time features capture temporal patterns that raw humidity alone misses |
| **Uncertainty** | MC Dropout (not quantile regression) | Minimal architecture changes, reuses existing dropout layers |
| **Validation** | Temporal 80/20 split (not random) | Prevents data leakage in time series |
| **Normalization** | Per-feature min-max (not global) | Preserves relative feature magnitudes, stored in artifact for inference |
| **Evaluation DB** | TimescaleDB (separate from MySQL) | Time-optimized hypertables for forecast data, avoids impacting operational queries |
| **Alerting** | Node.js orchestrates (Python forecasts) | Alert debounce, user notifications, and Socket.IO already exist in Node |
| **Baseline** | Linear regression + naive | Validates that GRU complexity is justified by performance improvement |

## 10. File Dependency Graph

```mermaid
graph TB
    MAIN["main.py"] --> FC["forecast.py"]
    MAIN --> TR["train.py"]
    MAIN --> EVAL_ROUTER["evaluation.py"]
    MAIN --> DRIFT_ROUTER["drift.py"]
    MAIN --> DISEASE["disease.py"]
    MAIN --> REG["model_registry.py"]

    FC --> PREDICT["predict.py"]
    PREDICT --> INFER_DATASET["make_infer_dataset.py"]
    PREDICT --> BUILD_FEATURES["build_features.py"]
    PREDICT --> MYSQL_SRC["mysql_source.py"]
    PREDICT --> TS_STORE["timescale_store.py"]

    TR --> TRAIN_RNN["train_rnn.py"]
    TR --> TUNE_RNN["tune_rnn.py"]

    TRAIN_RNN --> TRAIN_DATASET["make_train_dataset.py"]
    TRAIN_RNN --> BUILD_FEATURES
    TRAIN_RNN --> MYSQL_SRC

    TUNE_RNN --> TRAIN_RNN

    EVAL_ROUTER --> EVALUATOR["evaluator.py"]
    EVALUATOR --> MYSQL_SRC
    EVALUATOR --> TS_STORE

    DRIFT_ROUTER --> DRIFT_MON["drift_monitor.py"]
    DRIFT_MON --> TS_STORE

    BUILD_FEATURES --> LAG["lag_features.py"]
    BUILD_FEATURES --> TIME["time_features.py"]
    BUILD_FEATURES --> WEATHER["weather_features.py"]

    INFER_DATASET --> BUILD_FEATURES
    INFER_DATASET --> MYSQL_SRC
    TRAIN_DATASET --> BUILD_FEATURES
    TRAIN_DATASET --> MYSQL_SRC
```
