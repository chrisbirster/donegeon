import { css } from "@linaria/core";
import {
  ChevronDown,
} from "lucide-solid";

import {
  NavigationMenu,
  type Orientation,
} from "@kobalte/core/navigation-menu";


const navRoot = css`
  display: none;
  list-style: none;
  @media (min-width: 768px) {
    display: flex;
    gap: 1.5rem;
  }
`;
const navTrigger = css`
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray500);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
  &:hover { color: #fff; }
`;

export function HeaderNav() {
  return (
    <NavigationMenu class={navRoot} orientation={"horizontal" satisfies Orientation}>
      {/* -------------- Dropdown 1 -------------- */}
      <NavigationMenu.Menu>
        <NavigationMenu.Trigger class={navTrigger}>
          What For
          <NavigationMenu.Icon>
            <ChevronDown size={14} />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>

        <NavigationMenu.Portal>
          <NavigationMenu.Content
            class={css`
              /* pop‑up panel */
              background: #fff;
              padding: 1rem;
              border-radius: 6px;
            `}
          >
            <NavigationMenu.Item as="a" href="#teams" class={css`display:block; padding:.5rem 0;`}>
              For teams
            </NavigationMenu.Item>
            <NavigationMenu.Item as="a" href="#individuals" class={css`display:block; padding:.5rem 0;`}>
              For individuals
            </NavigationMenu.Item>
          </NavigationMenu.Content>
        </NavigationMenu.Portal>
      </NavigationMenu.Menu>

      {/* -------------- Dropdown 2 -------------- */}
      <NavigationMenu.Menu>
        <NavigationMenu.Trigger class={navTrigger}>
          Resources
          <NavigationMenu.Icon>
            <ChevronDown size={14} />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Portal>
          <NavigationMenu.Content
            class={css`
              background: #fff;
              padding: 1rem;
              border-radius: 6px;
            `}
          >
            <NavigationMenu.Item as="a" href="#blog" class={css`display:block; padding:.5rem 0;`}>
              Blog
            </NavigationMenu.Item>
            <NavigationMenu.Item as="a" href="#docs" class={css`display:block; padding:.5rem 0;`}>
              Docs
            </NavigationMenu.Item>
          </NavigationMenu.Content>
        </NavigationMenu.Portal>
      </NavigationMenu.Menu>

      {/* simple link (no dropdown) */}
      <NavigationMenu.Trigger as="a" href="#pricing" class={navTrigger}>
        Pricing
      </NavigationMenu.Trigger>

      {/* Viewport/arrow handles portal positioning */}
      <NavigationMenu.Viewport
        class={css`
          position: absolute;
          z-index: 1000;
        `}
      >
        <NavigationMenu.Arrow />
      </NavigationMenu.Viewport>
    </NavigationMenu>
  );
}
