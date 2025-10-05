from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # MongoDB配置 (云端)
    MONGODB_URI: str = "mongodb://mongodb:Qq1970251968@117.50.201.9:27018/"
    MONGODB_DATABASE: str = "waveform-annotation-system"

    # Redis配置 (云端)
    REDIS_URL: str = "redis://:Qq1970251968@117.50.201.9:26739"

    # JWT配置
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DAYS: int = 7

    # H5数据路径
    H5_DATA_PATH: str = "../dataset"

    # CORS配置
    CORS_ORIGINS: list = ["http://localhost:5173"]

    class Config:
        env_file = ".env"

settings = Settings()
