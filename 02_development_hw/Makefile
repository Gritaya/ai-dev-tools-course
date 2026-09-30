.PHONY: help install run test

help:
	@echo "Available targets:"
	@echo "  make install  Install backend dependencies with uv"
	@echo "  make run      Start the backend at http://127.0.0.1:8000"
	@echo "  make test     Run backend tests"

install:
	uv sync --directory backend

run:
	uv run --directory backend python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

test:
	uv run --directory backend python -m pytest
