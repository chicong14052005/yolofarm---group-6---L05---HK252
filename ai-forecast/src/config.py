import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_name: str = os.getenv("AI_FORECAST_APP_NAME", "YoloFarm AI Forecast")
    app_env: str = os.getenv("AI_FORECAST_ENV", "development")
    api_token: str = os.getenv("AI_SERVICE_TOKEN", "")
    model_path: str = os.getenv("MODEL_ARTIFACT_PATH", "artifacts/models/humidity_gru.pt")

    # Database
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: int = int(os.getenv("DB_PORT", "3307"))
    db_user: str = os.getenv("DB_USER", "root")
    db_password: str = os.getenv("DB_PASSWORD", "root")
    db_name: str = os.getenv("DB_NAME", "yolofarm")

    # Model architecture
    hidden_size: int = int(os.getenv("HIDDEN_SIZE", "64"))
    num_layers: int = int(os.getenv("NUM_LAYERS", "2"))
    lookback_steps: int = int(os.getenv("LOOKBACK_STEPS", "96"))
    dropout: float = float(os.getenv("DROPOUT", "0.2"))

    # Training
    learning_rate: float = float(os.getenv("LEARNING_RATE", "1e-3"))
    max_epochs: int = int(os.getenv("MAX_EPOCHS", "100"))
    early_stopping_patience: int = int(os.getenv("EARLY_STOPPING_PATIENCE", "10"))

    # Inference
    mc_dropout_samples: int = int(os.getenv("MC_DROPOUT_SAMPLES", "50"))
    horizon_hours_default: int = int(os.getenv("HORIZON_HOURS_DEFAULT", "24"))
    history_hours_default: int = int(os.getenv("HISTORY_HOURS_DEFAULT", "720"))


settings = Settings()
