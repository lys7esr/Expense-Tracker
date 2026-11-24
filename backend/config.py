DEV_USER_ID = 1


class Config:
    SQLALCHEMY_DATABASE_URI = "sqlite:///spendwise.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
