# Household Chores MVP

The backend starts with Django, Django REST Framework, and SQLite. The root
endpoint is a health check that returns `{"status": "ok"}`.

## Local development

In PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Visit `http://127.0.0.1:8000/` to check that the API is healthy.

## Tests

```powershell
python manage.py test
```
