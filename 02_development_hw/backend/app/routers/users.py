from fastapi import APIRouter, Depends

from app.auth import current_user
from app.models import User
from app.store import store

router = APIRouter(tags=["Users"])


@router.get("/users", response_model=list[User])
def list_users(_: User = Depends(current_user)) -> list[User]:
    return list(store.users.values())
