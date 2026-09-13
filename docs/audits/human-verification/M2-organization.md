# M2 — Organization human verification

Goal: confirm projects, sections, labels, favorites, archive/delete, task movement, and the organization entry controls behave the way a human expects.

## Session

- Commit reviewed: `ff5a0c26ee6e9b3f967292c88e42e45cb92fed27`
- Date: `2026-09-12`
- Reviewer: `Chris Birster`
- Automated evidence: `M2 Remediation Audit #74 (34734495855) PASS`; `CI #233 (34734495873) PASS`
- Accessibility smoke: keyboard-only PASS; VoiceOver PASS on audited M2 surfaces
- Final verdict: `PASS`

## Human verification

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Full Add Task | Sidebar `Add Task` opens an empty full task editor; inline Quick Add remains the separate fast-capture path | `PASS` | Full editor now supports the shared Quick Add grammar, visible token highlighting, and in-context organization creation. |
| Create project | Project creation is discoverable from the Tasks/project UI and the new project appears in expected navigation | `PASS` | Available from project UI and task project picker. |
| Rename project | Rename is discoverable and the new name persists after reload | `PASS` | Project edit mode exposes actions without permanently consuming sidebar width. |
| Favorite/unfavorite | Favorite state and ordering are understandable and durable; a favorite can be removed directly from Favorites | `PASS` | Direct removal from Favorites verified. |
| Archive project | Project leaves active navigation without deleting contained tasks unexpectedly | `PASS` | Archive remains distinct from delete. |
| Unarchive project | Project returns with expected state through a discoverable archived-project recovery surface | `PASS` | Archived-project recovery verified. |
| Delete project | Project/sections are removed; tasks survive with placement cleared | `PASS` | Destructive delete preserves tasks and clears project/section placement. |
| Inbox/default protection | Destructive operations that should be forbidden are visibly prevented | `PASS` | Protected projects do not expose destructive project actions. |
| Create section | Section creation is discoverable and the section appears under the correct project | `PASS` | Available from project UI and task section picker. |
| Rename section | Name persists | `PASS` | Verified after reload. |
| Delete section | Tasks remain in project but lose the deleted section | `PASS` | Tasks return to the unsectioned group. |
| Create label | Label creation/management is discoverable and the label becomes usable on a task | `PASS` | Available from label management and task label picker. |
| Rename label | Linked tasks show the renamed label | `PASS` | Usage remains linked and visible. |
| Remove/delete label | Task remains; label link disappears | `PASS` | Task survival verified. |
| Move task to project | Placement changes without losing unrelated fields | `PASS` | Description, labels, and priority remain intact. |
| Move task to section | Section implies/retains the correct project | `PASS` | Project view now visibly groups tasks by section. |
| Clear project | Project and stale section clear together | `PASS` | Verified through Task Detail and reload. |
| Invalid project/section pairing | Mutation is rejected/prevented without moving the task | `PASS` | Section picker exposes only sections belonging to the selected project. |

## Product questions

- [x] `Add Task` and Quick Add have clearly different, useful purposes.
- [x] Project deletion policy is what we actually want.
- [x] Section deletion policy is what we actually want.
- [x] Archive is meaningfully different from delete in the UI.
- [x] Favorites are useful and understandable, including removal directly from Favorites.
- [x] Project, section, and label management is discoverable without knowing an API or hidden side-effect path.
- [x] Task movement is discoverable on desktop and mobile where intended.

## Accessibility smoke

The M2 surfaces were exercised with keyboard-only navigation and macOS VoiceOver after remediation. Dialog focus entry/restore, picker/menu keyboard behavior, accessible control names, section headings, and save actions were understandable and operable in the reviewed flows. The broader repository-wide WCAG 2.2 AA / Section 508 program remains tracked separately; this PASS certifies the M2 organization surfaces, not a blanket compliance claim for the entire application.

## M2 exit decision

- [x] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. Human review initially found missing Full Add Task smart parsing, broken Quick Add token highlights, stale Tailwind-style runtime classes, native dropdown styling, missing in-context project/section/label creation, unclear scheduling/section UX, invisible section grouping, modal/menu interaction issues, sidebar spacing, and accessibility gaps. These were repaired and regression-tested before certification.
2. Keyboard review found action menus could remain visually open after focus left; shared `ActionMenu` was fixed so Arrow keys navigate, Escape restores trigger focus, and Tab/Shift+Tab close the menu while continuing normal focus traversal.
3. VoiceOver review found visually uppercased `ADD` controls were spoken as an acronym. Shared `Button` now exposes sentence-case accessible names while preserving visual uppercase styling; final VoiceOver retest announced `Add task, button` correctly. The additional `complementary` announcement is expected landmark context from the task sidebar.
