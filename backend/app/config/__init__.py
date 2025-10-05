from __future__ import annotations

import os
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """全局配置"""

    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://mongodb:Qq1970251968@117.50.201.9:27018/")
    MONGODB_DATABASE: str = os.getenv("MONGODB_DATABASE", "waveform-annotation-system")

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://:Qq1970251968@117.50.201.9:26739")

    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY",
        "your-secret-key-change-in-production-please",
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRATION_DAYS: int = int(os.getenv("JWT_EXPIRATION_DAYS", "7"))

    H5_DATA_PATH: str = os.getenv("H5_DATA_PATH", "../dataset")

    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
