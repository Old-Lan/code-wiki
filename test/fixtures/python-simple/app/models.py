from enum import Enum
from typing import Optional


class UserStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class User:
    def __init__(self, id: int, name: str, email: str) -> None:
        self.id = id
        self.name = name
        self.email = email

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "email": self.email}


def validate_email(email: str) -> bool:
    return "@" in email
