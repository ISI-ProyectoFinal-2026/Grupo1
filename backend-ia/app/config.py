from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Config leída de variables de entorno / archivo .env (ver README.md)."""

    database_url: str = "postgresql+asyncpg://patitas:patitas@localhost:5433/patitas"
    sql_echo: bool = False
    internal_api_key: str = ""
    node_backend_url: str = ""

    # Escotilla SOLO para desarrollo local: permite arrancar sin
    # INTERNAL_API_KEY y atender el endpoint de embeddings sin autenticar.
    # Tiene que pedirse a mano (ALLOW_INSECURE_INTERNAL=true); el default es
    # False a proposito, para que una configuracion ausente deje el servicio
    # CERRADO y no abierto — ver verify_internal_key en app/main.py y la
    # issue #106.
    allow_insecure_internal: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
