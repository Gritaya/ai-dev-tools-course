# Shared Household Chores — MVP Scope

## 1. Purpose

A simple household chore management tool focused on:

* Scheduling chores
* Assigning chores
* Reassigning chores
* Completing chores
* Automatically generating recurring chores

The MVP uses mock household data and does not include login or household management.

---

## 2. Household

The MVP has one fixed household with three members:

* Alice
* Bob
* Jerry

No user accounts or login system are required.

---

## 3. Chores

A chore contains:

* **Name**
* **Due date**
* **Assignee**
* **Status**
* **Recurring**

### Status

* `PENDING`
* `COMPLETED`
* `OVERDUE`

---

## 4. Create Chore

Users can create:

### One-time chore

Example:

```text
Name: Take out trash
Due date: Sunday
Assignee: Alice
Recurring: No
```

### Recurring chore

Example:

```text
Name: Take out trash
First due date: Sunday
Assignee: Alice
Recurring: Yes
```

Recurring chores repeat **7 days after the previous occurrence**.

---

## 5. Recurring Chores

When a recurring chore is completed, the system automatically creates the next occurrence.

The assignee rotates in a fixed order:

```text
Alice → Bob → Jerry → Alice → ...
```

Example:

```text
Week 1: Take out trash → Alice
Week 2: Take out trash → Bob
Week 3: Take out trash → Jerry
Week 4: Take out trash → Alice
```

The first occurrence starts on the user-selected due date.

For the MVP, weekly recurrence is the only supported recurrence type.

---

## 6. Assignment

Users can assign a chore to any household member:

```text
Alice
Bob
Jerry
```

Recurring chores automatically assign the next occurrence according to the rotation order.

---

## 7. Reassignment

Any chore can be manually reassigned.

Example:

```text
Alice → Jerry
```

This allows users to change the assigned member when necessary.

---

## 8. Completing a Chore

A user can mark a pending chore as completed.

For a recurring chore:

```text
Complete current chore
        ↓
Generate next occurrence
        ↓
Assign next member in rotation
```

---

## 9. Deleting a Chore

Users can delete a chore.

Deleting a recurring chore stops future occurrences from being generated.

---

## 10. Overdue Chores

A chore becomes `OVERDUE` when its due date has passed and it has not been completed.

For the MVP, overdue chores are only displayed as overdue.

No automatic reassignment is performed.

---

## 11. Main UI

The MVP has two main views.

### Calendar

The primary view.

The calendar displays:

* Chore
* Assignee
* Completion status

### Chore List

A secondary list view showing:

* Upcoming chores
* Overdue chores

---

## 12. Mock Data

The MVP can use hardcoded/mock members and chore data.

Example members:

```text
Alice
Bob
Jerry
```

Example chores:

```text
Take out trash
Clean kitchen
Wash dishes
```

No database or authentication is required initially if mock/local data is sufficient for development.

---

## 13. Out of Scope

The following are intentionally excluded from the MVP:

* User login/authentication
* Household creation/joining
* Multiple households
* Member management
* Notifications
* Chore voting or approval
* Fairness calculations
* Points or difficulty levels
* Chore history
* Complex recurrence rules
* Permissions/roles
* Automatic reassignment of overdue chores

---

## 14. MVP Success Criteria

The MVP is complete when a user can:

1. Create a chore.
2. Choose its due date.
3. Assign it to Alice, Bob, or Jerry.
4. Create a recurring chore.
5. Mark a chore as completed.
6. Automatically generate the next recurring occurrence.
7. See the assignee rotate `Alice → Bob → Jerry`.
8. Manually reassign a chore.
9. Delete a chore.
10. See chores on the calendar and in the chore list.
11. See incomplete past-due chores as overdue.
