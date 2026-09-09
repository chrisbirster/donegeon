# M2 — Organization human verification

Goal: confirm projects, sections, labels, favorites, archive/delete, task movement, and the organization entry controls behave the way a human expects.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Automated evidence: `________________`
- Final verdict: `NOT_REVIEWED`

## Human verification

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Full Add Task | Sidebar `Add Task` opens an empty full task editor; inline Quick Add remains the separate fast-capture path | `NOT_REVIEWED` | |
| Create project | Project creation is discoverable from the Tasks/project UI and the new project appears in expected navigation | `NOT_REVIEWED` | hidden creation only as a side effect of editing an existing task is insufficient |
| Rename project | Rename is discoverable and the new name persists after reload | `NOT_REVIEWED` | |
| Favorite/unfavorite | Favorite state and ordering are understandable and durable; a favorite can be removed directly from Favorites | `NOT_REVIEWED` | |
| Archive project | Project leaves active navigation without deleting contained tasks unexpectedly | `NOT_REVIEWED` | |
| Unarchive project | Project returns with expected state through a discoverable archived-project recovery surface | `NOT_REVIEWED` | |
| Delete project | Project/sections are removed; tasks survive with placement cleared | `NOT_REVIEWED` | |
| Inbox/default protection | Destructive operations that should be forbidden are visibly prevented | `NOT_REVIEWED` | |
| Create section | Section creation is discoverable and the section appears under the correct project | `NOT_REVIEWED` | |
| Rename section | Name persists | `NOT_REVIEWED` | |
| Delete section | Tasks remain in project but lose the deleted section | `NOT_REVIEWED` | |
| Create label | Label creation/management is discoverable and the label becomes usable on a task | `NOT_REVIEWED` | |
| Rename label | Linked tasks show the renamed label | `NOT_REVIEWED` | |
| Remove/delete label | Task remains; label link disappears | `NOT_REVIEWED` | |
| Move task to project | Placement changes without losing unrelated fields | `NOT_REVIEWED` | |
| Move task to section | Section implies/retains the correct project | `NOT_REVIEWED` | |
| Clear project | Project and stale section clear together | `NOT_REVIEWED` | |
| Invalid project/section pairing | Mutation is rejected/prevented without moving the task | `NOT_REVIEWED` | |

## Product questions

- [ ] `Add Task` and Quick Add have clearly different, useful purposes.
- [ ] Project deletion policy is what we actually want.
- [ ] Section deletion policy is what we actually want.
- [ ] Archive is meaningfully different from delete in the UI.
- [ ] Favorites are useful and understandable, including removal directly from Favorites.
- [ ] Project, section, and label management is discoverable without knowing an API or hidden side-effect path.
- [ ] Task movement is discoverable on desktop and mobile where intended.

## M2 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`
