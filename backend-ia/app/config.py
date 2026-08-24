from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Config leída de variables de entorno / archivo .env (ver README.md)."""

    database_url: str = "postgresql+asyncpg://patitas:patitas@localhost:5433/patitas"
    sql_echo: bool = False
    internal_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
