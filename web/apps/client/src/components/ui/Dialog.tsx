import { css } from "@linaria/core";
import { onSettled, type JSX, type ParentProps } from "solid-js";

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

export default function Dialog(props: DialogProps): JSX.Element {
  let panel!: HTMLDivElement;
  let previousFocus: HTMLElement | null = null;

  onSettled(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusInitial = () => {
      const autofocus = panel.querySelector<HTMLElement>("[autofocus]");
      const first = panel.querySelector<HTMLElement>(focusableSelector);
      (autofocus ?? first ?? panel).focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
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
      previousFocus?.focus();
    };
  });

  return (
    <div
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
  width: min(36rem, 100%);
  max-height: calc(100vh - 2rem);
  overflow: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-2xl);
  background: var(--panel);
  color: var(--text-main);
  box-shadow: var(--shadow-elevated);
  outline: none;
  &:focus-visible {
    outline: 2px solid #00e0ff;
    outline-offset: 3px;
  }
`;
