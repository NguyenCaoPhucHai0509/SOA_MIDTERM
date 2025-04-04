from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os

current_dir = os.path.dirname(__file__)

class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    model_config = SettingsConfigDict(env_file=f"{current_dir}/.env")

@lru_cache
def get_settings():
    return Settings()