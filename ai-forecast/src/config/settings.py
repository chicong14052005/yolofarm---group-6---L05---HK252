import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_name: str = os.getenv("AI_FORECAST_APP_NAME", "YoloFarm AI Forecast")
    app_env: str = os.getenv("AI_FORECAST_ENV", "development")
    api_token: str = os.getenv("AI_SERVICE_TOKEN", "")
    model_path: str = os.getenv("MODEL_ARTIFACT_PATH", "artifacts/models/gru_latest.pt")
    mysql_dsn: str = os.getenv("MYSQL_DSN", "")
    timescale_dsn: str = os.getenv("TIMESCALE_DSN", "")

    # Training hyperparameters
    hidden_size: int = int(os.getenv("HIDDEN_SIZE", "64"))
    num_layers: int = int(os.getenv("NUM_LAYERS", "2"))
    lookback: int = int(os.getenv("LOOKBACK", "24"))
    learning_rate: float = float(os.getenv("LEARNING_RATE", "1e-3"))
    max_epochs: int = int(os.getenv("MAX_EPOCHS", "100"))
    early_stopping_patience: int = int(os.getenv("EARLY_STOPPING_PATIENCE", "10"))
    dropout: float = float(os.getenv("DROPOUT", "0.2"))

    # Inference
    mc_dropout_samples: int = int(os.getenv("MC_DROPOUT_SAMPLES", "50"))


settings = Settings()
