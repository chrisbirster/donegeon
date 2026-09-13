# Accessibility verification — WCAG 2.2 AA / Section 508

Use this checklist for release evidence on user-facing changes. Record **PASS**, **NEEDS_WORK**, or **FAIL** plus concrete evidence for each row. Automated checks support this review but do not replace human keyboard and screen-reader verification.

| Check | Verdict | Evidence |
| --- | --- | --- |
| Complete primary task flow using keyboard only; no pointer required |  |  |
| Focus order follows the visual/logical task order |  |  |
| Every interactive control has a meaningful accessible name |  |  |
| Focus indicator remains clearly visible on all interactive controls |  |  |
| Dialog opens with focus inside, traps Tab/Shift+Tab, closes with Escape, and restores trigger focus |  |  |
| Menus open and operate by keyboard; Escape and outside click dismiss them |  |  |
| Combobox/listbox pickers expose expanded/selected state and support Arrow Up/Down, Home/End, Enter/click, and Escape |  |  |
| Form labels, help text, validation messages, and errors are programmatically associated with controls |  |  |
| Project/section task grouping has meaningful heading/region structure for a screen reader |  |  |
| Drag/reorder functionality has an equivalent keyboard action |  |  |
| State is not conveyed by color alone |  |  |
| Text and interactive-control contrast meet WCAG 2.2 AA |  |  |
| Page remains usable at 200% zoom and narrow/reflow widths without loss of content or operation |  |  |
| Reduced-motion preference removes non-essential movement |  |  |
| Status/error updates that require immediate awareness are announced appropriately |  |  |
| VoiceOver smoke: landmarks/headings/controls are understandable and task create/detail organization flows are operable |  |  |
| Automated browser accessibility scan reports no serious/critical violations on the changed surface |  |  |

## M2 organization smoke path

For M2 specifically, verify the following end-to-end with keyboard and VoiceOver:

1. Open **Full Add Task**, confirm focus enters the dialog, and close/reopen it with Escape.
2. Use Project, Section, and Label pickers without a pointer, including in-context creation.
3. Create a project and section, create a task, and confirm the task appears under the named section heading.
4. Open project and section action menus, move through actions by keyboard, and dismiss with Escape.
5. Open Task Detail, change project/section/labels, save, and confirm focus/navigation remains understandable.
6. Reorder a task using the Move Up / Move Down controls instead of drag-and-drop.
7. Confirm the **No section** group is announced meaningfully for unsectioned project tasks.

## Evidence rules

- Include browser/OS and assistive technology version for human screen-reader evidence.
- A screenshot is useful for focus/contrast evidence but is not sufficient for keyboard or screen-reader behavior.
- Do not mark a milestone certified while any required row remains **NEEDS_WORK** or **FAIL**.
