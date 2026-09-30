from fastapi import APIRouter, Depends, Response

from app.auth import current_user
from app.models import Task, TaskCreateInput, TaskMoveInput, TaskUpdateInput, User
from app.store import store

router = APIRouter(tags=["Tasks"])


@router.post("/boards/{board_id}/tasks", response_model=Task, status_code=201)
def create_task(
    board_id: str,
    data: TaskCreateInput,
    user: User = Depends(current_user),
) -> Task:
    return store.create_task(user, board_id, data.model_dump())


@router.patch("/tasks/{task_id}", response_model=Task)
def update_task(
    task_id: str,
    data: TaskUpdateInput,
    user: User = Depends(current_user),
) -> Task:
    return store.update_task(user, task_id, data.model_dump(exclude_unset=True))


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, user: User = Depends(current_user)) -> Response:
    store.delete_task(user, task_id)
    return Response(status_code=204)


@router.patch("/tasks/{task_id}/move", response_model=Task)
def move_task(
    task_id: str,
    data: TaskMoveInput,
    user: User = Depends(current_user),
) -> Task:
    return store.move_task(user, task_id, data.to_column_id, data.to_position)
