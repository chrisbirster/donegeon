# Quest Spec (YAML Source of Truth)

This file defines how quests should be written so players can understand exactly how to complete them.

## Source Of Truth
- Runtime quest data is loaded from `docs/quests.yaml` by default.
- Server boot loads it via `LoadQuestCatalog` in `internal/board/quests_catalog.go`.
- Config path can be overridden with `DONEGEON_QUEST_CONFIG_PATH` (or `DONEGEON_QUESTS_PATH`).
- If no YAML path is available, the server falls back to the in-code defaults.

## Quest Authoring Contract
Every quest definition should include these player-facing fields:
- `how_to_complete`: plain-language action the player should take.
- `definition_of_done`: exact condition that must become true.
- `acceptance_criteria`: testable checks that map to objective progress.

Minimum technical fields remain required:
- `id`, `title`, `type`, `scope`, `objectives`, `rewards`

## Objective Operations (What Actually Counts)
Use this table to avoid ambiguous wording.

| `op` | Counts when | Notes |
| --- | --- | --- |
| `create_task` | A new board task is created or first linked to a persisted task | Metric key: `quest.create_task` |
| `complete_task` | A task is marked done | Metric key: `quest.complete_task` |
| `process_inbox_count` | `task.activate` succeeds ("Make Live on Board") | Creating a task named "process inbox" does **not** count |
| `assign_villager` | A villager is assigned to a task stack | Metric key: `quest.assign_villager` |
| `open_deck` | A deck pack is opened | Use `ref` for specific deck IDs when needed |
| `attach_modifier` | A modifier is attached to a task stack | Metric key: `quest.attach_modifier` |
| `clear_zombie` | A zombie stack is cleared | Metric key: `quest.clear_zombie` |
| `keep_zombies_below` | Current zombie count is `<= value` | Evaluated from board state, not event counter |
| `reduce_backlog_to` | Open backlog task count is `<= value` | Evaluated from task list state |

## Definition Of Done Example (Process Inbox)
Quest: `DQ_ProcessInbox`
- Player action: open Tasks view and click **Make Live on Board** on three tasks.
- Definition of done: `process_inbox_count >= 3` for today.
- Acceptance criteria:
  - Each successful `task.activate` increments `process_inbox_count` by 1.
  - Failed activations do not increment progress.
  - Typing words like "process the inbox" in a task title has no effect.

## QA Checklist For New Quests
Before adding or changing a quest in YAML:
1. Write `how_to_complete` in player language, not command names.
2. Write `definition_of_done` as one measurable condition.
3. Add at least one acceptance criterion per objective.
4. Confirm each `op` exists in quest progression logic (`quests.go`).
5. Verify quest can be completed via integration test or manual repro path.
