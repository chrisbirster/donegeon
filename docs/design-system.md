# Donegeon UI design system

Donegeon uses **SolidJS + Linaria/WyW semantic styles**. Runtime Tailwind utility classes are not part of the client architecture and must not be introduced.

## Core rules

1. Prefer semantic HTML before ARIA. Use ARIA to describe state and relationships that native HTML does not provide.
2. Interactive controls must be keyboard-operable, have a visible `:focus-visible` treatment, and expose a stable accessible name.
3. Use the checked-in CSS custom properties (`--panel`, `--text-main`, `--border-strong`, `--accent`, etc.) before adding new one-off values.
4. Component styling belongs in Linaria `css` declarations. Do not return Tailwind-like strings such as `bg-[…]`, `text-[…]`, `rounded-*`, `px-*`, or `--tw-*` runtime composition from feature models.
5. A feature should reuse shared primitives instead of rebuilding modal, menu, picker, or button behavior locally.
6. State must never be communicated by color alone. Include text, an icon with an accessible label, `aria-pressed`, `aria-selected`, or another programmatic state as appropriate.
7. Respect `prefers-reduced-motion` for non-essential transitions and animation.

## Shared primitives

### `Button`

Use `components/Button.tsx` for application actions. It owns variants, sizing, focus treatment, disabled state, and correct serialization of boolean `aria-*` state. Use `unstyled` only when the semantic behavior of a button is required but a specialized surface owns its full visual treatment.

### `Dialog`

Use `components/ui/Dialog.tsx` for modal UI. It provides:

- `role="dialog"` and `aria-modal="true"`
- initial focus entry
- Tab/Shift+Tab focus containment
- Escape dismissal
- focus restoration to the trigger
- optional backdrop dismissal

Do not recreate fixed modal backdrops in feature components.

### `Picker`

Use `components/ui/Picker.tsx` rather than native `<select>` for Donegeon project/section/label assignment surfaces. It exposes combobox/listbox semantics, Arrow Up/Down, Home/End, Escape, outside-click dismissal, selected state, descriptions, and optional in-context creation actions.

Task organization wrappers are:

- `ProjectPicker`
- `SectionPicker`
- `LabelPicker`

These wrappers keep project/section/label creation and selection consistent between Full Add Task and Task Detail.

### `ActionMenu`

Use the shared menu/popover primitive for `…` action menus. Menus must dismiss on Escape and outside click and support keyboard focus movement. Do not add feature-local document listeners for the same behavior.

### Quick Add token presentation

`QuickAddTokenInput` is the semantic token-highlighting surface for smart task text. Tasks and Board surfaces should reuse `quickAddTokenClass()` rather than construct runtime utility class strings.

## Organization semantics

- A **project** owns tasks and sections.
- A **section** is an optional subgroup/lane inside exactly one project.
- A task may be in a project with no section; project views expose this as **No section**.
- A section cannot be assigned across projects.
- Deleting a section preserves its tasks and returns them to the unsectioned group.
- A **label** is reusable metadata and may be assigned to many tasks; management UI should expose usage impact before rename/delete.

## Scheduling presentation

The task list shows the current effective **Due** and **Deadline** values. The original natural-language schedule input may be retained and surfaced in Task Detail under an explicit history/original-input label; do not show cryptic `original → current` text in the normal task row.

## Accessibility baseline

The product target is **WCAG 2.2 AA** with explicit **Section 508** verification. Shipping a control with an `aria-label` is not sufficient evidence by itself. M2 organization surfaces must prove keyboard operation, focus behavior, meaningful grouping, visible focus, and a non-drag reorder path in browser tests plus the human accessibility checklist.
