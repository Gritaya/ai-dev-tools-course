from __future__ import annotations

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models import User
from app.store import ApiError, store

bearer_scheme = HTTPBearer(auto_error=False)


def token_from_request(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str | None:
    if credentials is not None:
        return credentials.credentials
    return request.cookies.get("access_token")


def optional_current_user(token: str | None = Depends(token_from_request)) -> User | None:
    return store.user_for_token(token)


def current_user(user: User | None = Depends(optional_current_user)) -> User:
    if user is None:
        raise ApiError(401, "Missing or invalid authentication")
    return user
