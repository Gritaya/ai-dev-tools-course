from fastapi import APIRouter, Depends, Response

from app.auth import current_user
from app.models import (
    Board,
    BoardColumn,
    BoardDetail,
    ColumnOrderInput,
    MemberInput,
    NameInput,
    User,
)
from app.store import store

router = APIRouter(tags=["Boards", "Members", "Columns"])


@router.get("/boards", response_model=list[Board])
def list_boards(user: User = Depends(current_user)) -> list[Board]:
    return store.list_boards(user)


@router.post("/boards", response_model=Board, status_code=201)
def create_board(data: NameInput, user: User = Depends(current_user)) -> Board:
    return store.create_board(user, data.name)


@router.get("/boards/{board_id}", response_model=BoardDetail)
def get_board(board_id: str, user: User = Depends(current_user)) -> BoardDetail:
    return store.board_detail(user, board_id)


@router.patch("/boards/{board_id}", response_model=Board)
def rename_board(board_id: str, data: NameInput, user: User = Depends(current_user)) -> Board:
    return store.rename_board(user, board_id, data.name)


@router.delete("/boards/{board_id}", status_code=204)
def delete_board(board_id: str, user: User = Depends(current_user)) -> Response:
    store.delete_board(user, board_id)
    return Response(status_code=204)


@router.post("/boards/{board_id}/members", response_model=User)
def add_member(board_id: str, data: MemberInput, user: User = Depends(current_user)) -> User:
    return store.add_member(user, board_id, data.email)


@router.delete("/boards/{board_id}/members/{user_id}", status_code=204)
def remove_member(board_id: str, user_id: str, user: User = Depends(current_user)) -> Response:
    store.remove_member(user, board_id, user_id)
    return Response(status_code=204)


@router.post("/boards/{board_id}/columns", response_model=BoardColumn, status_code=201)
def create_column(board_id: str, data: NameInput, user: User = Depends(current_user)) -> BoardColumn:
    return store.create_column(user, board_id, data.name)


@router.patch("/boards/{board_id}/columns/reorder", response_model=list[BoardColumn])
def reorder_columns(
    board_id: str,
    data: ColumnOrderInput,
    user: User = Depends(current_user),
) -> list[BoardColumn]:
    return store.reorder_columns(user, board_id, data.ordered_column_ids)
