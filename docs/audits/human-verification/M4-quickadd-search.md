# M4 — Quick Add and search human verification

Goal: verify that fast task capture and finding tasks behave predictably for a human, not merely according to parser tests.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Automated evidence: `________________`
- Final verdict: `NOT_REVIEWED`

## Human verification

Use memorable test values so each parsed field is obvious after save/reload.

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Plain Quick Add | Content saves exactly as intended | `NOT_REVIEWED` | |
| Add description | Description is parsed/saved without corrupting title | `NOT_REVIEWED` | |
| Add priority | Priority is parsed, visible, durable | `NOT_REVIEWED` | |
| Add project token | Task lands in intended project | `NOT_REVIEWED` | |
| Add label token(s) | Labels are attached and durable | `NOT_REVIEWED` | |
| Add due expression | Preview and saved due value agree | `NOT_REVIEWED` | |
| Add deadline | Preview and saved deadline agree | `NOT_REVIEWED` | |
| Add recurrence | Preview and saved recurrence agree | `NOT_REVIEWED` | |
| Combined metadata | Multiple tokens can coexist without eating task content | `NOT_REVIEWED` | |
| Upper/lower-case priority | Equivalent supported syntax behaves consistently | `NOT_REVIEWED` | |
| Assignee-looking token | UI does not imply durable assignment exists | `NOT_REVIEWED` | |
| Search by title | Expected task appears | `NOT_REVIEWED` | |
| Search by description | Expected task appears | `NOT_REVIEWED` | |
| Search by project name | Expected task appears according to browser search contract | `NOT_REVIEWED` | |
| Search after reload | Persisted task is still discoverable | `NOT_REVIEWED` | |
| No-match search | Empty state is understandable | `NOT_REVIEWED` | |

## Product questions

- [ ] Quick Add syntax feels learnable.
- [ ] Preview is trustworthy enough to submit without fear.
- [ ] Unsupported assignee syntax is not misleading.
- [ ] Search scope matches what a user would naturally expect.
- [ ] Browser search and compatibility filter semantics are not presented as the same feature.

## M4 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`