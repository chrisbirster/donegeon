# M6 — Browser acceptance human verification

Goal: watch the real user journey in Chromium and decide whether the product behavior is acceptable, not merely whether Playwright assertions pass.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Playwright mode: `headed | ui | debug`
- Final verdict: `NOT_REVIEWED`

## Recommended command

From `web/`:

```bash
npm --workspace @donegeon/client run test:e2e:ui -- \
  tests/e2e/task-manager-audit.spec.ts
```

The Playwright config starts a real Go server, fresh temporary SQLite DB, Vite client, and Chromium.

## Desktop journey

| Observation | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Quick Add task | Task appears immediately | `NOT_REVIEWED` | |
| Metadata/detail | Entered metadata is visible correctly | `NOT_REVIEWED` | |
| Reload | Task rehydrates from persisted state | `NOT_REVIEWED` | |
| Search | Persisted task is found | `NOT_REVIEWED` | |
| Detail from search | Correct task opens | `NOT_REVIEWED` | |
| Scheduling controls | Date/priority/recurrence controls are understandable | `NOT_REVIEWED` | |
| Complete normal task | UI updates immediately and durably | `NOT_REVIEWED` | |
| Complete recurring task | Next occurrence appears correctly | `NOT_REVIEWED` | |

## Mobile/responsive journey

| Observation | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Open/close sidebar | Interaction is reliable and obvious | `NOT_REVIEWED` | |
| Quick Add | Core add flow remains usable | `NOT_REVIEWED` | |
| Reload | Task persists and reappears | `NOT_REVIEWED` | |
| Search | Drawer/modal layering does not block use | `NOT_REVIEWED` | |
| Open detail | Fields remain readable/editable | `NOT_REVIEWED` | |
| Complete task | Completion works without desktop-only assumptions | `NOT_REVIEWED` | |

## Human-only questions

- [ ] The journey feels coherent rather than like disconnected testable controls.
- [ ] Loading/refresh transitions are acceptable.
- [ ] No obvious layout shift, stale data, or flicker undermines confidence.
- [ ] Error/empty states are understandable.
- [ ] Mobile controls are comfortably usable.
- [ ] Nothing important is technically passing but visually misleading.

## M6 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`