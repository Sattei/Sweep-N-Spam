from pydantic import BaseSettings

class Settings(BaseSettings):
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/callback"

    class Config:
        env_file = ".env"

settings = Settings()
