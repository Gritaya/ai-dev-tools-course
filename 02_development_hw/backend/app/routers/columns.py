from fastapi import APIRouter, Depends, Response

from app.auth import current_user
from app.models import BoardColumn, NameInput, User
from app.store import store

router = APIRouter(prefix="/columns", tags=["Columns"])


@router.patch("/{column_id}", response_model=BoardColumn)
def rename_column(column_id: str, data: NameInput, user: User = Depends(current_user)) -> BoardColumn:
    return store.rename_column(user, column_id, data.name)


@router.delete("/{column_id}", status_code=204)
def delete_column(column_id: str, user: User = Depends(current_user)) -> Response:
    store.delete_column(user, column_id)
    return Response(status_code=204)
