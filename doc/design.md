# Donegeon Design System

This document consolidates the August 14, 2026 brand board, product UI kit, marketing page, mission board, and board-game workspace references into one implementation contract.

## Product direction

Donegeon turns team task management into a neon-noir mission board. The product should feel like a practical operations tool wearing the visual language of a gritty comic: dense, legible, tactile, and energetic. Function always wins over decoration.

Primary voice: direct, street-smart, and action oriented. The core promise is “Turn chaos into coordination.” Supporting language may use the crew, mission, board, stack, intel, momentum, and reward vocabulary, but ordinary controls must remain immediately understandable.

## Visual principles

1. **Dark-first clarity.** Near-black and midnight-navy surfaces carry the interface. Off-white is the primary reading color; muted gray distinguishes secondary information.
2. **Neon with restraint.** Purple and magenta identify brand and primary action. Cyan marks information/focus, orange marks review or urgency, green marks success, and red marks danger. Glows indicate focus or importance, not general decoration.
3. **Comic texture, product discipline.** Brush marks, halftone, paper grain, grid lines, city haze, and illustrated characters belong in large atmospheric areas. Data-heavy panels stay calm and readable.
4. **Layered boards.** Thin borders, subtle inner light, and deep shadows separate panels. Selected objects receive a stronger purple outline and glow.
5. **Compact density.** The board is a working surface. Favor short labels, consistent 4 px spacing increments, and strong grouping over oversized whitespace.

## Tokens

### Color

| Role | Value | Usage |
| --- | --- | --- |
| Deep black | `#080614` | Page foundation |
| Night sky | `#0b0e14` → `#1a1f29` | Background and elevated dark surfaces |
| Neon purple | `#8a2be2` | Brand depth and gradients |
| Purple 600 | `#c445ff` | Primary action, active navigation, focus |
| Electric cyan | `#00e0ff` | Information and focus mode |
| Electric magenta | `#ff2072` | Brand accent and expressive marks |
| Ember orange | `#ff8a00` | Review, attention, reward warmth |
| Success | `#22c55e` | Complete, recurrence, positive movement |
| Warning | `#ff9e0b` | Due soon and review |
| Danger | `#ff4444` | Destructive and overdue |
| Off-white | `#f2f1ed` | Primary text |
| Muted gray | `#918a95` | Secondary text |

Recommended gradients are neon purple (`#8a2be2 → #c445ff`), sunset city (`#ff8a00 → #ff2072`), electric (`#00e0ff → #8a2be2`), and dark vignette (`#000000 → #1a1f29`).

### Typography

- Display/headline: a condensed, distressed comic display face when licensed assets are available; `Space Grotesk` is the web fallback. Use tight leading and uppercase sparingly for impact.
- UI/body: `IBM Plex Sans`, with system sans-serif fallback. Body copy remains clean and highly readable.
- Accent/brush: a permanent-marker style face for short callouts only. Never use it for controls or paragraphs.
- Micro labels: 10–12 px, semibold, uppercase, tracking `0.08–0.18em`.

### Spacing, shape, and depth

- Base spacing unit: 4 px. Core steps: 4, 8, 12, 16, 24, 32, 48, 64, and 96 px.
- Radius: 6 px small controls, 10 px panels, 14 px prominent cards, 20 px marketing surfaces, and pill radius only for chips/toggles.
- Border: 1 px default, 2 px selected/active, 3 px for deliberately illustrated frames.
- Shadows: small `0 2px 6px rgba(0,0,0,.25)`, medium `0 4px 12px rgba(0,0,0,.35)`, large `0 8px 24px rgba(0,0,0,.45)`, extra-large `0 16px 48px rgba(0,0,0,.55)`.
- Purple glow: `0 0 16px rgba(196,69,255,.35)`, stronger active state up to 32 px. Cyan glow follows the same model with `#00e0ff`.

## Application structure

The desktop product uses a persistent left navigation rail, compact top bar, central mission board, optional right detail drawer, scheduled lane, and bottom analytics/energy region. The board columns are Backlog, Planning, In Progress, Review, and Done. Cards combine a task title, villager identity, stamina/level, deadline, recurrence, next-action, or focus modifiers.

The alternate freeform board uses a full canvas with a slim board/goals sidebar, top resource bar, minimap, draggable card stacks, and deck tray. Card color communicates archetype: task/magenta, villager/gold, food/orange, resource/green, modifier/slate. It should remain visually related to the mission board through the same tokens and typography.

Responsive behavior:

- Under 768 px, replace the persistent sidebar with a drawer and bottom navigation.
- Detail panels become full-height modal sheets.
- Board columns scroll horizontally; never compress cards below their usable width.
- Marketing sections stack to one column and reduce atmospheric artwork before reducing text contrast.

## Marketing structure

The landing page includes an announcement bar, navigation, cinematic hero, product board preview, four benefit cards, testimonial, proof statistics, security banner, and restrained footer. The hero owns most of the illustration density; later sections alternate quiet dark panels with small neon accents.

Primary CTA: “Join waitlist.” Secondary CTA: “See how it works.” Tertiary actions use outlined or text-only treatment. Avoid placing two equally bright actions side by side.

## Component states

Every interactive component must define default, hover, focus-visible, active/selected, disabled, loading, empty, and error behavior where applicable. Focus-visible receives a clear 2 px purple or cyan ring with adequate offset. Do not encode status by color alone: pair color with icon, label, border treatment, or shape.

Cards and panels use a thin neutral border by default, brighter border on hover, and colored glow only when active. Destructive buttons remain outlined until confirmation. Motion should be subtle: 120–180 ms hover transitions, brief staggered entrances for marketing cards, and a slow optional neon pulse for major accents. Honor `prefers-reduced-motion`.

### Button system

All application buttons use the shared `Button` component. There are five semantic variants: `primary` for the main action, `secondary` for standard actions, `ghost` for low-emphasis navigation or cancellation, `warning` for cautionary actions, and `danger` for destructive actions. Each variant supports `sm`, `md`, and `lg` sizes plus `block` and `iconOnly` layout options. Feature components should not recreate button colors, borders, focus states, disabled states, or typography locally.

## Illustration and texture

Use bold comic linework, hard graphic shadows, confident characters, neon rim lighting, urban night environments, magenta/orange/cyan cinematic color, palm silhouettes, rain-slick streets, and restrained halftone. Illustrations should communicate capability or character; they must not sit behind dense text without a strong vignette.

## Accessibility

- Meet WCAG AA contrast for text and interactive controls.
- Keep body copy at 16 px where space permits and never below 12 px for operational metadata.
- Maintain visible keyboard focus and logical DOM order independent of board positioning.
- Provide text alternatives for illustration and icon-only controls.
- Keep touch targets at least 44 × 44 px on mobile.
- Ensure drag-and-drop actions have keyboard and menu alternatives.

## Styling implementation

Global browser normalization lives in `styles/reset.css`; root tokens, fonts, page background, and theme-level layout live in `styles/rootlayout.css`. Component styles stay in the component module using Linaria:

```tsx
import { css } from "@linaria/core";

const section = css`
  background-color: #bada55;
`;

export function Example() {
  return <div class={section}>…</div>;
}
```

Use one semantic constant per stable visual role (`panel`, `title`, `primaryAction`), combine constants for conditional states, and keep runtime values in CSS custom properties or inline style only when they are genuinely dynamic. Do not reintroduce utility-class strings or Tailwind dependencies.
