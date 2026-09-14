# M3 reminder contract

M3 introduces first-class task reminders.

- One absolute reminder instant per task (`reminderAt`).
- The HTTP client sends RFC3339/ISO instants; the service normalizes them in the request timezone.
- Invalid reminder values are rejected as validation errors.
- Create, read, update, and explicit clear are supported.
- Checked tasks retain their reminder value for audit/history but are no longer active work.
- Deleted tasks remain hidden by the existing soft-delete contract.
- Recurring tasks shift the next reminder by the same offset from the task due time. If a recurring task lacks a due anchor, the next occurrence does not inherit a stale absolute reminder.
- Tenant/workspace scoping is inherited from the canonical task repository and has dedicated reminder coverage.
- Quick Add reminder syntax and relative-to-due reminder rules are not part of M3 v1. They may be added later only with parser parity tests.
