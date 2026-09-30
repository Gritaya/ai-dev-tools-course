import os

from fastapi import APIRouter, Depends, Response

from app.auth import optional_current_user, token_from_request
from app.models import Credentials, RegisterInput, User
from app.store import store

router = APIRouter(prefix="/auth", tags=["Authentication"])


def set_session(response: Response, user: User) -> None:
    token = store.issue_token(user.id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "").lower() == "true",
        samesite="lax",
        path="/",
    )
    response.headers["X-Auth-Token"] = token


@router.post("/register", response_model=User, status_code=201)
def register(data: RegisterInput, response: Response) -> User:
    user = store.create_user(data.email, data.password, data.name)
    set_session(response, user)
    return user


@router.post("/login", response_model=User)
def login(data: Credentials, response: Response) -> User:
    user = store.authenticate(data.email, data.password)
    set_session(response, user)
    return user


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    token: str | None = Depends(token_from_request),
) -> Response:
    store.revoke_token(token)
    response.delete_cookie(key="access_token", path="/", httponly=True, samesite="lax")
    response.status_code = 204
    return response


@router.get("/me", response_model=User | None)
def get_current_user(user: User | None = Depends(optional_current_user)) -> User | None:
    return user
