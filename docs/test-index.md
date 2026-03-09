# Test Coverage Index

This repo now keeps large YAML specs split by domain. Use this page as the entry point instead of reading one giant fixture file.

## Coverage map

| Area | Primary source | Executed by | Notes |
| --- | --- | --- | --- |
| Quick-add parser | `docs/specs/quickadd/*.yaml` | `internal/quickadd/parser_spec_test.go` | 144 parser cases, including NLP phrases and schedule wording |
| Quick-add recurrence edge cases | Go tests | `internal/quickadd/parser_recurrence_test.go` | Focused assertions for RRULE wording and numeric-leading tokens |
| Task creation / quick-add persistence | Go tests | `internal/task/service_integration_test.go` | Covers RRULE persistence, due/deadline normalization, alias resolution, labels |
| TaskManager-compatible API actions | `docs/specs/taskmanager/*.yaml` | `internal/httpapi/taskmanager_parity_spec_test.go` | One YAML file per action instead of one archive file |
| Parity action audit | Go test | `internal/httpapi/taskmanager_parity_coverage_test.go` | Fails if dispatch actions drift away from YAML coverage |
| Onboarding and account setup | Go tests | `internal/account/service_integration_test.go` | Covers personal onboarding, pro onboarding, invitation acceptance |
| Login and onboarding UX | Playwright | `web/apps/client/tests/e2e/login-onboarding.interactions.spec.ts` | Request flow, verify flow, invitation lock, onboarding form behavior |
| Board command / game rules | Go tests | `internal/board/service_integration_test.go` | Command matrix, merge rules, quests, persistence, economy, zombie pipeline |
| Board UI and task UI | Playwright | `web/apps/client/tests/e2e/board.spec.ts` and related e2e specs | User-facing board and task interactions |
| Board spec draft | `docs/test-case-board.yaml` | Not wired to a runner today | Keep only as a readable checklist until it becomes executable |

## Split spec layout

### Quick-add parser specs

- `docs/specs/quickadd/01-core.yaml`
- `docs/specs/quickadd/02-projects-and-labels.yaml`
- `docs/specs/quickadd/03-metadata.yaml`
- `docs/specs/quickadd/04-deadlines.yaml`
- `docs/specs/quickadd/05-relative-due.yaml`
- `docs/specs/quickadd/06-calendar-due.yaml`
- `docs/specs/quickadd/07-nlp-and-rrule.yaml`

### TaskManager parity specs

- One YAML file per action under `docs/specs/taskmanager/`
- Examples:
  - `docs/specs/taskmanager/addTask.yaml`
  - `docs/specs/taskmanager/getTasks.yaml`
  - `docs/specs/taskmanager/updateProject.yaml`
  - `docs/specs/taskmanager/acceptWorkspaceInvitation.yaml`

## Known gaps

- Board split-stack drag flow is still called out as not covered in `web/apps/client/tests/e2e/FEATURE_COVERAGE.md`.
- Board collect-deck loot flow is still called out as not covered in `web/apps/client/tests/e2e/FEATURE_COVERAGE.md`.
- Error-path UX assertions are still called out as not covered in `web/apps/client/tests/e2e/FEATURE_COVERAGE.md`.
- `docs/test-case-board.yaml` is descriptive only until a runner is added.
