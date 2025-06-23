import {
  createSignal,
  Show,
  For,
  onCleanup,
  onMount,
} from "solid-js";
import { css } from "@linaria/core";
import { Flag } from "lucide-solid";

const outlineButton = css`
  background: transparent;
  border: 1px solid #4b5563;
  color: #d1d5db;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: #374151;
  }
`;

const menuBox = css`
  position: absolute;
  z-index: 50;
  margin-top: 0.25rem;            /* space below button */
  min-width: 10rem;
  background: #1f2937;            /* gray-800 */
  border: 1px solid #4b5563;      /* gray-600 */
  border-radius: 0.375rem;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.4);
`;

const menuItem = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  color: #d1d5db;
  cursor: pointer;
  border: none;

  &:hover {
    background: #374151;
  }
`;

const check = css`
  margin-left: auto;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #ef4444; /* red-500 */
`;

const container = css`
  position: relative;
  display: inline-block;
`;


export const TaskPriority = () => {
  const [priority, setPriority] = createSignal<number | null>(null);
  const [open, setOpen] = createSignal(false);

  const label = () => (priority() == null ? "Priority" : `P${priority()}`);
  const flagColor = (p: number | null) =>
    p == null
      ? "#6b7280"
      : ["#ef4444", "#eab308", "#3b82f6", "#9ca3af"][p - 1];

  let btnRef!: HTMLButtonElement;
  let menuRef!: HTMLDivElement;

  /* close when clicking outside */
  const handleGlobal = (e: MouseEvent) => {
    if (!open()) return;
    const t = e.target as Node;
    if (!menuRef.contains(t) && !btnRef.contains(t)) setOpen(false);
  };

  onMount(() => document.addEventListener("mousedown", handleGlobal));
  onCleanup(() => document.removeEventListener("mousedown", handleGlobal));

  const priorities = [1, 2, 3, 4];

  const choose = (p: number) => {
    setPriority(p);
    setOpen(false);
  };

  return (
    <div class={container}>
      <button
        ref={btnRef}
        class={outlineButton}
        onClick={() => setOpen(!open())}
      >
        <Flag size={16} color={flagColor(priority())} />
        {label()}
      </button>

      <Show when={open()}>
        <div ref={menuRef} class={menuBox}>
          <For each={priorities}>
            {(p) => (
              <button
                class={menuItem}
                onClick={() => choose(p)}
              >
                <Flag size={16} color={flagColor(p)} />
                Priority&nbsp;{p}
                {/* show a tick on the current selection */}
                <Show when={priority() === p}>
                  <span class={check} />
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
