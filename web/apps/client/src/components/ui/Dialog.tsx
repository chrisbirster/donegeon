import { css } from "@linaria/core";
import { onSettled, type ParentProps } from "solid-js";
import type { JSX } from "@solidjs/web";

export type DialogProps = ParentProps<{
  ariaLabel: string;
  onClose: () => void;
  class?: string;
  testId?: string;
  closeOnBackdrop?: boolean;
}>;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const dialogStack: HTMLDivElement[] = [];

type BackgroundState = {
  element: HTMLElement;
  inert: string | null;
  ariaHidden: string | null;
};

function makeBackgroundInert(backdrop: HTMLElement): BackgroundState[] {
  const changed: BackgroundState[] = [];
  let current: HTMLElement | null = backdrop;

  while (current?.parentElement && current.parentElement !== document.documentElement) {
    const container: HTMLElement = current.parentElement;
    for (const sibling of Array.from(container.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === current) continue;
      changed.push({
        element: sibling,
        inert: sibling.getAttribute("inert"),
        ariaHidden: sibling.getAttribute("aria-hidden"),
      });
      sibling.setAttribute("inert", "");
      sibling.setAttribute("aria-hidden", "true");
    }
    if (container === document.body) break;
    current = container;
  }

  return changed;
}

function restoreBackground(states: BackgroundState[]) {
  for (const state of states.reverse()) {
    if (state.inert === null) state.element.removeAttribute("inert");
    else state.element.setAttribute("inert", state.inert);

    if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
    else state.element.setAttribute("aria-hidden", state.ariaHidden);
  }
}

export default function Dialog(props: DialogProps): JSX.Element {
  let backdropElement!: HTMLDivElement;
  let panel!: HTMLDivElement;
  let previousFocus: HTMLElement | null = null;

  onSettled(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backgroundState = makeBackgroundInert(backdropElement);
    dialogStack.push(panel);

    const focusInitial = () => {
      if (dialogStack.at(-1) !== panel) return;
      const autofocus = panel.querySelector<HTMLElement>("[autofocus]");
      const first = panel.querySelector<HTMLElement>(focusableSelector);
      (autofocus ?? first ?? panel).focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== panel) return;

      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => element.offsetParent !== null,
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    queueMicrotask(focusInitial);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = dialogStack.lastIndexOf(panel);
      if (index >= 0) dialogStack.splice(index, 1);
      restoreBackground(backgroundState);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  });

  return (
    <div
      ref={backdropElement}
      class={backdrop}
      onMouseDown={(event) => {
        if (props.closeOnBackdrop === false) return;
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div
        ref={panel}
        class={`${panelBase} ${props.class ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={props.ariaLabel}
        tabindex={-1}
        data-testid={props.testId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}

export const dialogHeader = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.3rem;
  border-bottom: 1px solid var(--border-strong);
`;

export const dialogEyebrow = css`
  margin: 0;
  color: var(--text-dim);
  font-size: .68rem;
  letter-spacing: .14em;
  text-transform: uppercase;
`;

export const dialogTitle = css`
  margin: .18rem 0 0;
  color: var(--text-main);
  font-size: 1.2rem;
`;

const backdrop = css`
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 1rem;
  background: rgba(0, 0, 0, .72);
  backdrop-filter: blur(8px);
`;

const panelBase = css`
  position: relative;
  max-height: min(92vh, 58rem);
  overflow: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-2xl);
  background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end));
  color: var(--text-main);
  box-shadow: var(--shadow-elevated);
  &:focus { outline: none; }
`;
