# Architecture

## Recommended Tech Stack

For this project, the recommended stack is:

- Backend: Django
- API layer: Django REST Framework (DRF)
- Frontend: React + Vite
- Database: SQLite for the MVP, with PostgreSQL as a natural upgrade path
- Authentication: Django authentication, planned for a later phase

This stack fits the MVP scope because the app is relatively small, has a fixed household model, and does not require a fully distributed backend yet. It also leaves room to add user authentication, household management, and deeper user-specific features without a major rewrite.

## Why this stack

### Django
Django provides a mature backend framework with:

- built-in authentication support
- a clear ORM for data modeling
- strong conventions for app structure and maintenance
- easy API integration through DRF

This makes it a strong long-term foundation, especially because authentication is expected to be introduced later.

### Django REST Framework
DRF is the right API layer for this setup because it allows the frontend to interact with the backend through clean REST endpoints while keeping business logic on the server side.

It is useful for:

- creating and listing chores
- updating chore status and assignee
- handling recurring chores
- preparing for user-based access control in future phases

### React + Vite
React is a good fit for the calendar and chore list experience because it supports modular UI components and dynamic state updates efficiently.

Benefits include:

- reusable components for calendar, list, and forms
- easier handling of interactive status changes
- a clean separation between UI rendering and backend API calls

Vite keeps the frontend development workflow lightweight and fast.

### SQLite for MVP
SQLite is appropriate for the initial version because the app does not yet require a production-grade relational database setup.

It supports:

- fast local development
- simple setup
- easy testing of the MVP

PostgreSQL is a sensible next step once the app is ready for real users or expands beyond the prototype stage.

## High-Level Architecture

The application is structured as a layered system:

1. Frontend (React + Vite)
   - calendar dashboard
   - chore list
   - create/edit chore forms
   - status and assignment interactions

2. API layer (Django + DRF)
   - endpoints for chores, members, and household data
   - validation rules for recurring chores
   - assignment and completion logic

3. Data layer (SQLite initially)
   - household data
   - member data
   - chore records
   - recurring rules and status tracking

## Expected Component Responsibilities

### Frontend responsibilities
- render calendar view
- render list view
- allow users to create, update, delete, and complete chores
- display overdue and recurring chore states
- communicate with backend APIs

### Backend responsibilities
- store chores and members
- validate due dates and recurring rules
- assign recurring chores in rotation
- generate next occurrence when a chore is completed
- expose a stable API for the UI

## Future Growth Path

This architecture supports the next milestone after the MVP:

- add Django authentication
- add user accounts and household membership
- move from SQLite to PostgreSQL
- enforce per-user access rules and permissions
- add an AI assistant for chore suggestions and planning

The app can grow without replacing the core stack.

## AI Chore Suggestion Support

The architecture is compatible with an AI chatbot feature for chore suggestions because the backend already separates:

- domain data (household members, chores, due dates, statuses)
- business logic (recurrence, assignment rotation, completion rules)
- API access (backend endpoints that the frontend consumes)

This makes it straightforward to add an AI service later that reads chore history and household context and returns recommendations such as:

- chore suggestions based on workload
- assignment recommendations
- suggestions for recurring chore timing
- reminders or next-best-task recommendations

### Recommended integration pattern

Use a dedicated AI service or backend endpoint that receives structured input from the app, such as:

- household members
- current chores
- overdue chores
- completed tasks
- recurring patterns

It then returns suggested actions or recommendations without coupling the chatbot directly to the UI.

This keeps the architecture clean:

- React UI renders the chatbot experience
- Django/DRF exposes structured chore data and recommendation endpoints
- the AI layer can be implemented as a separate service or an internal Django integration
- the data model stays consistent as authentication and AI features are added

### Why this is a good fit

The app’s data model already supports the types of inputs a chore suggestion assistant would need:

- assignee
- due date
- status
- recurring behavior
- household members

This means the AI feature can be added later as a thin extension rather than a redesign.

## Summary

The chosen architecture is:

- Django for the backend foundation
- DRF for the API layer
- React + Vite for the frontend
- SQLite for the MVP database

This provides a practical, scalable foundation for the chore tracker while keeping the MVP simple and aligned with the project scope.
