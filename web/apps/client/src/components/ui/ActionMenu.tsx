import { css } from "@linaria/core";
import { For, Show, createSignal, onSettled } from "solid-js";

import Button from "../Button";

export type ActionMenuItem = {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
};

export type ActionMenuProps = {
  ariaLabel: string;
  items: ActionMenuItem[];
  glyph?: string;
  class?: string;
};

export default function ActionMenu(props: ActionMenuProps) {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;
  let menu!: HTMLDivElement;
  let trigger!: HTMLButtonElement;

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) queueMicrotask(() => trigger?.focus());
  };

  const focusItem = (offset: number) => {
    queueMicrotask(() => {
      const items = Array.from(menu?.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])") ?? []);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = current < 0 ? (offset > 0 ? 0 : items.length - 1) : (current + offset + items.length) % items.length;
      items[next]?.focus();
    });
  };

  onSettled(() => {
    const outside = (event: PointerEvent) => {
      if (!open()) return;
      if (event.target instanceof Node && !root.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open()) {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  });

  return (
    <div class={`${rootStyle} ${props.class ?? ""}`} ref={root}>
      <Button
        ref={trigger}
        type="button"
        unstyled
        class={triggerStyle}
        aria-label={props.ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            focusItem(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            focusItem(-1);
          }
        }}
      >
        <span aria-hidden="true">{props.glyph ?? "•••"}</span>
      </Button>
      <Show when={open()}>
        <div
          ref={menu}
          class={menuStyle}
          role="menu"
          aria-label={props.ariaLabel}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusItem(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusItem(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              menu.querySelector<HTMLElement>("[role='menuitem']:not([disabled])")?.focus();
            } else if (event.key === "End") {
              event.preventDefault();
              const items = menu.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])");
              items[items.length - 1]?.focus();
            }
          }}
        >
          <For each={props.items}>
            {(item) => (
              <Button
                type="button"
                unstyled
                role="menuitem"
                class={`${menuItemStyle} ${item.danger ? dangerStyle : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  void item.onSelect();
                }}
              >
                {item.label}
              </Button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

const rootStyle = css`position:relative; min-width:0;`;
const triggerStyle = css`
  display:flex; align-items:center; justify-content:center; width:100%; min-width:2.4rem; height:100%; min-height:2.4rem;
  border:1px solid var(--border-strong); border-radius:.65rem; background:var(--panel-soft); color:var(--text-dim); cursor:pointer;
  &:hover{border-color:var(--border-hover); color:var(--text-main);}
  &:focus-visible{outline:2px solid #00e0ff; outline-offset:2px;}
`;
const menuStyle = css`
  position:absolute; z-index:130; top:calc(100% + .3rem); right:0; min-width:9rem; display:flex; flex-direction:column; gap:.18rem;
  padding:.35rem; border:1px solid var(--border-strong); border-radius:.65rem; background:var(--panel); box-shadow:var(--shadow-elevated);
`;
const menuItemStyle = css`
  width:100%; border:0; border-radius:.45rem; padding:.55rem .65rem; background:transparent; color:var(--text-main); text-align:left; cursor:pointer;
  &:hover, &:focus-visible{background:rgba(196,69,255,.12); outline:none; box-shadow:inset 0 0 0 2px #00e0ff;}
  &:disabled{opacity:.45; cursor:not-allowed;}
`;
const dangerStyle = css`color:var(--danger);`;
