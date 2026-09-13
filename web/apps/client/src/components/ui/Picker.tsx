import { css } from "@linaria/core";
import { For, Show, createMemo, createSignal, onSettled } from "solid-js";

import Button from "../Button";

export type PickerOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type PickerProps = {
  id: string;
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void | Promise<void>;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  testId?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};

export default function Picker(props: PickerProps) {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;
  let popup!: HTMLDivElement;

  const selectedLabel = createMemo(
    () => props.options.find((option) => option.value === props.value)?.label ?? props.placeholder ?? "Select",
  );
  const listboxId = () => `${props.id}-listbox`;
  const descriptionId = () => `${props.id}-description`;

  const focusOption = (offset: number) => {
    queueMicrotask(() => {
      const options = Array.from(popup?.querySelectorAll<HTMLElement>("[role='option']:not([aria-disabled='true'])") ?? []);
      if (options.length === 0) return;
      const current = options.indexOf(document.activeElement as HTMLElement);
      const next = current < 0 ? (offset > 0 ? 0 : options.length - 1) : (current + offset + options.length) % options.length;
      options[next]?.focus();
    });
  };

  const openAndFocus = (direction: 1 | -1) => {
    if (props.disabled) return;
    setOpen(true);
    focusOption(direction);
  };

  const close = () => setOpen(false);
  const focusTrigger = () => root.querySelector<HTMLElement>("[role='combobox']")?.focus();

  onSettled(() => {
    const outside = (event: PointerEvent) => {
      if (!open()) return;
      if (event.target instanceof Node && !root.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !open()) return;
      // A picker nested in a Dialog owns the first Escape press. Capture it before
      // the parent dialog's document-level handler so the listbox closes without
      // dismissing the entire modal.
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      focusTrigger();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  });

  return (
    <div class={field} ref={root}>
      <label class={labelStyle} for={props.id}>{props.label}</label>
      <Button
        id={props.id}
        type="button"
        unstyled
        class={trigger}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={listboxId()}
        aria-describedby={props.description ? descriptionId() : undefined}
        disabled={props.disabled}
        data-testid={props.testId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openAndFocus(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openAndFocus(-1);
          }
        }}
      >
        <span class={triggerValue}>{selectedLabel()}</span>
        <span class={chevron} aria-hidden="true">⌄</span>
      </Button>
      <Show when={props.description}>
        <p id={descriptionId()} class={description}>{props.description}</p>
      </Show>

      <Show when={open()}>
        <div
          ref={popup}
          id={listboxId()}
          class={popupStyle}
          role="listbox"
          aria-label={props.label}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusOption(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusOption(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              const options = popup.querySelectorAll<HTMLElement>("[role='option']:not([aria-disabled='true'])");
              options[0]?.focus();
            } else if (event.key === "End") {
              event.preventDefault();
              const options = popup.querySelectorAll<HTMLElement>("[role='option']:not([aria-disabled='true'])");
              options[options.length - 1]?.focus();
            } else if (event.key === "Enter" || event.key === " ") {
              const active = document.activeElement;
              if (active instanceof HTMLButtonElement && active.getAttribute("role") === "option") {
                event.preventDefault();
                active.click();
              }
            }
          }}
        >
          <For each={props.options}>
            {(option) => (
              <Button
                type="button"
                unstyled
                class={`${optionStyle} ${option.value === props.value ? optionSelected : ""}`}
                role="option"
                aria-selected={option.value === props.value}
                aria-disabled={option.disabled === true}
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return;
                  void props.onChange(option.value);
                  close();
                  focusTrigger();
                }}
              >
                <span>{option.label}</span>
                <Show when={option.value === props.value}><span aria-hidden="true">✓</span></Show>
              </Button>
            )}
          </For>
          <Show when={props.actionLabel && props.onAction}>
            <div class={separator} />
            <Button
              type="button"
              unstyled
              class={actionStyle}
              onClick={() => {
                close();
                void props.onAction?.();
              }}
            >
              + {props.actionLabel}
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

const field = css`position:relative; display:flex; flex-direction:column; gap:.4rem;`;
const labelStyle = css`font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const trigger = css`
  display:flex; align-items:center; justify-content:space-between; gap:.75rem; width:100%; min-height:2.8rem;
  border:1px solid var(--border-strong); border-radius:.7rem; padding:.68rem .8rem;
  background:rgba(255,255,255,.035); color:var(--text-main); text-align:left; cursor:pointer;
  &:hover:not(:disabled){border-color:var(--border-hover); background:var(--panel-soft);}
  &:focus-visible{outline:2px solid #00e0ff; outline-offset:2px; border-color:var(--accent);}
  &:disabled{opacity:.5; cursor:not-allowed;}
`;
const triggerValue = css`min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
const chevron = css`flex:0 0 auto; color:var(--text-dim);`;
const description = css`margin:0; color:var(--text-dim); font-size:.72rem; line-height:1.35;`;
const popupStyle = css`
  position:absolute; z-index:120; top:calc(100% + .35rem); left:0; right:0; max-height:18rem; overflow:auto;
  display:flex; flex-direction:column; gap:.2rem; padding:.35rem; border:1px solid var(--border-strong); border-radius:.7rem;
  background:var(--panel); box-shadow:var(--shadow-elevated);
`;
const optionStyle = css`
  display:flex; align-items:center; justify-content:space-between; gap:.75rem; width:100%; border:0; border-radius:.5rem;
  padding:.6rem .7rem; background:transparent; color:var(--text-main); text-align:left; cursor:pointer;
  &:hover:not(:disabled), &:focus-visible{background:rgba(196,69,255,.12); outline:none;}
  &:focus-visible{box-shadow:inset 0 0 0 2px #00e0ff;}
  &:disabled{opacity:.45; cursor:not-allowed;}
`;
const optionSelected = css`background:var(--accent-wash); color:var(--accent-text);`;
const separator = css`height:1px; margin:.2rem .25rem; background:var(--border-soft);`;
const actionStyle = css`
  width:100%; border:0; border-radius:.5rem; padding:.6rem .7rem; background:transparent; color:var(--accent-text); text-align:left;
  cursor:pointer; &:hover, &:focus-visible{background:rgba(196,69,255,.12); outline:none; box-shadow:inset 0 0 0 2px #00e0ff;}
`;
