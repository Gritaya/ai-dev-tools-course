## 1. Bootstrap empty project with a passing smoke test
Goal: Create the base project and verify the app starts with a passing test.
Description: Set up the initial Django + DRF project skeleton with the minimum configuration needed to run locally. Add a simple smoke test that proves the project loads successfully and that the default application state is healthy before any feature work begins.

## 2. Define project structure and app boundaries
Goal: Organize the codebase into clear, independent Django apps.
Description: Create the main app layout for authentication, chores, household members, and shared project configuration. Keep the structure simple and modular so each feature can be developed and reviewed without needing the others to be complete.

## 3. Create the core household and member models
Goal: Add the baseline data model for household members.
Description: Define the models for the fixed household and the household members who can be assigned chores. Include the basic attributes needed for this MVP and keep the model intentionally simple so it is easy to evolve when authentication is added later.

## 4. Create the chore model and status fields
Goal: Add the central chore data model.
Description: Define the chore entity with fields for name, due date, assignee, status, and recurring flag. Include the minimum validation needed for the MVP so chores can be created and tracked consistently across the app.

## 5. Add database migration and seed data for the MVP
Goal: Prepare the database with a ready-to-use starting state.
Description: Generate the migration files for the data models and create a small seed set representing Alice, Bob, Jerry, and a few sample chores. This gives the team a predictable baseline for testing and demo work without needing a production database.

## 6. Build chore create and list API endpoints
Goal: Expose basic chore operations through the backend API.
Description: Implement the endpoints to create chores and retrieve the current chore list. Keep the handlers focused on the MVP flow so the frontend can develop against stable API contracts without depending on later features.

## 7. Build chore update, complete, and delete endpoints
Goal: Support common chore lifecycle actions.
Description: Add API endpoints for editing a chore, marking it completed, and deleting it. Include the minimum validation needed to prevent invalid state changes, especially around dates and assignee updates.

## 8. Implement overdue status calculation
Goal: Mark chores as overdue when they pass their due date.
Description: Add the logic that determines whether a chore should be considered overdue based on its due date and completion status. This task should also expose the computed status through the API so the frontend can render it consistently.

## 9. Implement recurring chore generation logic
Goal: Create the weekly recurring chore behavior.
Description: Add the logic to generate the next instance of a recurring chore after completion and rotate assignment according to the household order. Keep this task isolated so the recurrence rules can be tested directly without depending on the frontend.

## 10. Build the calendar view for chores
Goal: Show chores on a calendar-based interface.
Description: Create the frontend view that renders chores by date and includes the assignee and status information required by the MVP. Keep the component focused on display and basic interaction so it can be tested independently from the list view.

## 11. Build the chore list view and filters
Goal: Show upcoming and overdue chores in a list format.
Description: Create the secondary UI view for upcoming chores and overdue chores, and include the minimal controls needed to distinguish task states. This should be independent enough to be built and reviewed without the calendar view being complete.

## 12. Add create and edit chore forms in the frontend
Goal: Allow users to manage chores from the UI.
Description: Implement the form flows for creating a chore, editing its details, and updating the assignee or due date. Keep the forms simple and focused on the MVP requirements so they remain easy to test and hand off.

## 13. Wire the frontend to the backend API
Goal: Connect the UI to the Django API layer.
Description: Replace any mock front-end data with real API calls for listing, creating, editing, completing, and deleting chores. Validate the end-to-end flow so the app behaves like a connected system rather than a static prototype.

## 14. Add a chatbot-ready recommendations endpoint
Goal: Prepare the backend for future AI chore suggestions.
Description: Create a lightweight endpoint or service contract that can accept household and chore context and return recommendation payloads. This should be intentionally simple and isolated so it can later integrate with an LLM or recommendation service without affecting the rest of the app.

## 15. Add basic validation and smoke tests for chore behavior
Goal: Verify the core business rules still work as the app grows.
Description: Write tests for the most important chore rules, such as overdue logic, recurring generation, and assignment rotation. Keep these tests focused on behavior rather than implementation so the project remains maintainable as more features are added.
