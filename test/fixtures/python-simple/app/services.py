from typing import Optional
from .models import User, UserStatus, validate_email


def get_user(user_id: int) -> Optional[User]:
    return None


def create_user(name: str, email: str) -> User:
    if not validate_email(email):
        raise ValueError("Invalid email")
    return User(id=1, name=name, email=email)


async def fetch_remote(url: str) -> dict:
    import requests
    return {}
