# M4 — Quick Add and search human verification

Goal: verify that fast task capture and finding tasks behave predictably for a human, not merely according to parser tests.

## Session

- Commit: `1941310859439deee65ac54cc4390b45553d9e20`
- Date: `2026-09-14`
- Reviewer: `Chris Birster`
- Automated evidence: M4 Remediation Audit #10 (`34921438604`) — 16/16 passed in 33.2s; protected CI #262 (`34921438581`) — PASS
- Keyboard smoke check: `PASS`
- VoiceOver smoke check: `PASS`
- Final verdict: `PASS`

## Human verification

Use memorable test values so each parsed field is obvious after save/reload.

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Plain Quick Add | Content saves exactly as intended | `PASS` | Human verified on exact audited head. |
| Add description | Description is parsed/saved without corrupting title | `PASS` | Human verified on exact audited head. |
| Add priority | Priority is parsed, visible, durable | `PASS` | Human verified on exact audited head. |
| Add project token | Task lands in intended project | `PASS` | Human verified on exact audited head. |
| Add label token(s) | Labels are attached and durable | `PASS` | Human verified on exact audited head. |
| Add due expression | Preview and saved due value agree | `PASS` | Human verified on exact audited head. |
| Add deadline | Preview and saved deadline agree | `PASS` | Human verified on exact audited head. |
| Add recurrence | Preview and saved recurrence agree | `PASS` | Human verified on exact audited head. |
| Combined metadata | Multiple tokens can coexist without eating task content | `PASS` | Human verified on exact audited head. |
| Upper/lower-case priority | Equivalent supported syntax behaves consistently | `PASS` | `p2` and `P2` both verified. |
| Assignee-looking token | UI does not imply durable assignment exists | `PASS` | Unsupported `+assignee` syntax is explicitly blocked rather than silently discarded. |
| Search by title | Expected task appears | `PASS` | Human verified on exact audited head. |
| Search by description | Expected task appears | `PASS` | Human verified on exact audited head. |
| Search by project name | Expected task appears according to browser search contract | `PASS` | Human verified on exact audited head. |
| Search after reload | Persisted task is still discoverable | `PASS` | Human verified on exact audited head. |
| No-match search | Empty state is understandable | `PASS` | Human verified on exact audited head. |

## Product questions

- [x] Quick Add syntax feels learnable.
- [x] Preview is trustworthy enough to submit without fear.
- [x] Unsupported assignee syntax is not misleading.
- [x] Search scope matches what a user would naturally expect.
- [x] Browser search and compatibility filter semantics are not presented as the same feature.

## M4 exit decision

- [x] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. M4 human walkthrough passed on `1941310859439deee65ac54cc4390b45553d9e20` after automated M4 Audit #10 and protected CI #262 were green.
2. Keyboard-only smoke check passed.
3. VoiceOver smoke check passed.
