from fastapi import Header, HTTPException

from src.config.settings import settings


def verify_service_token(authorization: str | None = Header(default=None)) -> None:
    # If no token configured, keep local development open.
    if not settings.api_token:
        return

    expected = f"Bearer {settings.api_token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid service token")
