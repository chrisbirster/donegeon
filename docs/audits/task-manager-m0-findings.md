# Task manager M0 findings

This note records the first-pass findings that shape the implementation audit.

## 1. Compatibility success cases are not semantic proof

`internal/httpapi/taskmanager_parity_spec_test.go` currently treats any successful `2xx` response as a passing success case. The YAML suite remains useful for route, auth, dispatch, error-code and broad surface coverage, but happy-path rows cannot be promoted to semantic feature verification until the runner asserts response content and/or persisted state.

## 2. The canonical task model is narrower than the compatibility/parser surface

The durable task model in `internal/task` currently includes task content, description, project, section, sort order, recurrence, priority, due/scheduling data, labels, checked/deleted state and tenancy fields.

The first pass found no canonical durable fields for:

- parent task / subtask relationship;
- assignee;
- reminder;
- attachment/upload metadata.

Quick add can recognize assignee syntax, so that syntax must not be mistaken for a persisted assignment feature.

## 3. Recurrence is comparatively well proven

The task service has semantic integration tests that assert recurrence parsing/persistence and that completing a recurring task closes the current task and creates the next occurrence. This is the current model for the quality of evidence other task features should reach.

## 4. Browser tests contain useful semantic evidence

The Playwright task-action suite proves several real workflows rather than only HTTP status, including create-and-reload persistence, drag reorder persistence, inline edit save/cancel, deletion, search/detail navigation, responsive quick add and project creation controls.

These browser tests are useful evidence, but they do not replace domain/API tests for authorization, tenancy, error behavior or every durable field.

## 5. Public-tree naming cleanup

Migration version `000007` created workspace-related entities. Its old filename exposed an internal comparison name. M0 renames the files to:

- `000007_workspace_entities.up.sql`
- `000007_workspace_entities.down.sql`

The SQL and numeric migration version are unchanged.

## Next action

M1 should implement a single semantic lifecycle contract proving create → read/list → update → complete → reopen → delete across canonical service/repository and API boundaries, including tenancy and all supported task fields.
