from pathlib import Path

import yaml
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.models import ErrorResponse
from app.routers import auth, boards, columns, tasks, users
from app.store import ApiError

app = FastAPI(
    title="Mini Kanban API",
    version="1.0.0",
    description="SQLAlchemy-backed FastAPI backend for the Mini Kanban frontend.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Auth-Token"],
)


@app.exception_handler(ApiError)
async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(message=exc.message).model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    messages = "; ".join(error["msg"] for error in exc.errors())
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(message=messages or "Invalid request").model_dump(),
    )


@app.exception_handler(404)
async def handle_not_found(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content=ErrorResponse(message="Not found").model_dump(),
    )


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(boards.router)
app.include_router(columns.router)
app.include_router(tasks.router)

def openapi_from_contract() -> dict:
    if app.openapi_schema is None:
        contract_path = Path(__file__).resolve().parents[2] / "openapi.yaml"
        with contract_path.open(encoding="utf-8") as contract_file:
            app.openapi_schema = yaml.safe_load(contract_file)
    return app.openapi_schema


app.openapi = openapi_from_contract
