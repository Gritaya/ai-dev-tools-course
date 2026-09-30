# Mini Kanban Board — MVP Specification

## 1. Goal

A simple Kanban application supporting both personal and small-team task management.

The MVP focuses on:

* Multiple boards
* Custom workflow columns
* Task management
* Task assignment
* Drag-and-drop task movement
* Basic board membership

---

## 2. Users

### User

A user can:

* Create boards
* View boards they belong to
* Create, edit, and delete tasks
* Move tasks between columns
* Assign tasks to board members

### Board Owner

The user who creates a board.

The owner can:

* Rename the board
* Delete the board
* Manage columns
* Add/remove board members

### Permissions

For the MVP, all board members have the same task permissions.

There is no separate Admin/Member role system.

---

## 3. Boards

Users can create multiple independent boards.

### Board Fields

| Field       | Description                  |
| ----------- | ---------------------------- |
| `id`        | Unique board identifier      |
| `name`      | Board name                   |
| `owner`     | User who created the board   |
| `members`   | Users belonging to the board |
| `createdAt` | Creation timestamp           |
| `updatedAt` | Last update timestamp        |

### Board Operations

* Create board
* Rename board
* Delete board
* View board
* Add member
* Remove member

---

## 4. Columns

Columns represent the workflow of a board.

Columns are fully customizable.

Example:

```text
Ideas → To Do → In Progress → Review → Done
```

### Column Fields

| Field      | Description              |
| ---------- | ------------------------ |
| `id`       | Unique column identifier |
| `name`     | Column name              |
| `position` | Order within the board   |

### Column Operations

* Create column
* Rename column
* Delete column
* Reorder columns

### Rule

A column cannot be deleted while it contains tasks.

---

## 5. Tasks

Each task belongs to exactly one board column.

### Task Fields

| Field         | Required | Description                       |
| ------------- | -------- | --------------------------------- |
| `id`          | Yes      | Unique task identifier            |
| `title`       | Yes      | Task title                        |
| `description` | No       | Task details                      |
| `assignee`    | No       | Board member assigned to the task |
| `priority`    | No       | Low / Medium / High               |
| `dueDate`     | No       | Optional deadline                 |
| `column`      | Yes      | Current column                    |
| `position`    | Yes      | Order within the column           |
| `createdAt`   | Yes      | Creation timestamp                |
| `updatedAt`   | Yes      | Last update timestamp             |

### Task Operations

* Create task
* Edit task
* Delete task
* Assign/reassign task
* Change priority
* Set/remove due date
* Move task

---

## 6. Drag & Drop

Tasks are moved between columns using drag and drop.

Drag and drop must update:

1. The task's column
2. The task's position within that column

There is no separate "Move to..." button in the MVP.

Example:

```text
To Do                 In Progress
┌─────────────┐       ┌─────────────┐
│ Fix Login   │ ───►  │ Build API   │
└─────────────┘       └─────────────┘
```

---

## 7. Board Membership

The board owner can add or remove existing users.

For the MVP:

* No email invitations
* No teams/groups
* No role hierarchy
* No advanced permission system

Members can:

* View the board
* Create tasks
* Edit tasks
* Delete tasks
* Move tasks
* Assign tasks to board members

---

## 8. Authentication

Basic authentication is required.

### Features

* Register
* Login
* Logout

Users can only access:

* Boards they own
* Boards they are members of

---

## 9. Main Screens

### 9.1 Login / Register

Basic account authentication.

### 9.2 Board List

Displays boards accessible to the current user.

```text
My Boards

[ + Create Board ]

Personal
Team Project
University Project
```

### 9.3 Kanban Board

Displays columns and tasks.

```text
Team Project

[ To Do ]       [ In Progress ]       [ Done ]

Task A          Task C                Task E
Task B          Task D
```

Users can drag tasks between columns.

### 9.4 Task Detail / Edit

Used to:

* Create tasks
* View task details
* Edit tasks
* Assign tasks
* Set priority
* Set due date
* Delete tasks

---

## 10. Out of Scope — MVP

The following are intentionally excluded:

* Comments
* Attachments
* Checklists
* Labels / tags
* Notifications
* Activity history
* Search
* Filters
* Due-date reminders
* Email invitations
* Role-based permissions
* Real-time updates / WebSockets
* Mobile application
* Analytics
* Task archive
* Recurring tasks

These can be considered for future versions.

---

## 11. MVP Principle

> If a feature does not directly help a user create, organize, assign, or move a task, it should not be included in the first MVP.
