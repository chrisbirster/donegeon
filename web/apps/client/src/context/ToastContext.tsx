import Button from "../components/Button";
import { css } from "@linaria/core";
import { Accessor, For, ParentProps, createContext, createSignal, useContext } from "solid-js";

type ToastTone = "success" | "error" | "info";

type ToastRecord = {
  id: number;
  message: string;
  tone: ToastTone;
  createdAt: number;
};

type ToastAPI = {
  show: (message: string, tone?: ToastTone, durationMs?: number) => number;
  success: (message: string, durationMs?: number) => number;
  error: (message: string, durationMs?: number) => number;
  info: (message: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
  history: Accessor<ToastRecord[]>;
  clearHistory: () => void;
};

const ToastContext = createContext<ToastAPI>();
let nextToastID = 1;
const toastSuccess = css`border-color: #3d6b4e; background: #12281d; color: #baf2cd;`;
const toastError = css`border-color: #734040; background: #2b1717; color: #ffbaba;`;
const toastInfo = css`border-color: #415779; background: #152238; color: #d6e6ff;`;

function toastToneClass(tone: ToastTone): string {
  switch (tone) {
    case "success":
      return toastSuccess;
    case "error":
      return toastError;
    default:
      return toastInfo;
  }
}

export function ToastProvider(props: ParentProps) {
  const [toasts, setToasts] = createSignal<ToastRecord[]>([]);
  const [history, setHistory] = createSignal<ToastRecord[]>([]);
  const timers = new Map<number, number>();

  function dismiss(id: number) {
    const timer = timers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function show(message: string, tone: ToastTone = "info", durationMs = 3200): number {
    const trimmed = message.trim();
    if (!trimmed) return -1;
    const id = nextToastID++;
    const record: ToastRecord = {
      id,
      message: trimmed,
      tone,
      createdAt: Date.now(),
    };
    setToasts((current) => [...current, record]);
    setHistory((current) => [record, ...current].slice(0, 40));

    const timer = window.setTimeout(() => {
      dismiss(id);
    }, Math.max(1400, durationMs));
    timers.set(id, timer);
    return id;
  }

  const api: ToastAPI = {
    show,
    success: (message, durationMs) => show(message, "success", durationMs),
    error: (message, durationMs) => show(message, "error", durationMs),
    info: (message, durationMs) => show(message, "info", durationMs),
    dismiss,
    history,
    clearHistory: () => setHistory([]),
  };

  return (
    <ToastContext value={api}>
      {props.children}
      <div class={style1}>
        <For each={toasts()}>
          {(toast) => (
            <div
              class={` ${style2} ${toastToneClass(toast.tone)}`}
              data-testid="app-toast"
            >
              <div class={style3}>
                <p class={style4}>{toast.message}</p>
                <Button
                  type="button"
                  class={style5}
                  onClick={() => dismiss(toast.id)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </For>
      </div>
    </ToastContext>
  );
}

export function useToast() {
  return useContext(ToastContext);
}


const style1 = css`
pointer-events: none;
position: fixed;
bottom: max(14px, env(safe-area-inset-bottom));
left: calc(var(--spacing) * 3);
z-index: 140;
display: flex;
width: min(360px, calc(100vw - 1.5rem));
flex-direction: column;
gap: calc(var(--spacing) * 2);
@media (width >= 48rem) {
    left: calc(var(--spacing) * 4);
  }
`;

const style2 = css`
pointer-events: auto;
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
--tw-shadow: 0 18px 36px var(--tw-shadow-color, rgba(0,0,0,0.45));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style3 = css`
display: flex;
align-items: flex-start;
gap: calc(var(--spacing) * 2);
`;

const style4 = css`
min-width: calc(var(--spacing) * 0);
flex: 1;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: var(--leading-snug);
  line-height: var(--leading-snug);
`;

const style5 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #5f7292;
padding-inline: calc(var(--spacing) * 1.5);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: #d7e6ff;
text-transform: uppercase;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--accent);
    }
  }
`;
