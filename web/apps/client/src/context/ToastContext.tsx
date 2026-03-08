import { For, ParentProps, createContext, createSignal, useContext } from "solid-js";

type ToastTone = "success" | "error" | "info";

type ToastRecord = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastAPI = {
  show: (message: string, tone?: ToastTone, durationMs?: number) => number;
  success: (message: string, durationMs?: number) => number;
  error: (message: string, durationMs?: number) => number;
  info: (message: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastAPI>();
let nextToastID = 1;

function toastToneClass(tone: ToastTone): string {
  switch (tone) {
    case "success":
      return "border-[#3d6b4e] bg-[#12281d] text-[#baf2cd]";
    case "error":
      return "border-[#734040] bg-[#2b1717] text-[#ffbaba]";
    default:
      return "border-[#415779] bg-[#152238] text-[#d6e6ff]";
  }
}

export function ToastProvider(props: ParentProps) {
  const [toasts, setToasts] = createSignal<ToastRecord[]>([]);
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
    setToasts((current) => [...current, { id, message: trimmed, tone }]);

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
  };

  return (
    <ToastContext.Provider value={api}>
      {props.children}
      <div class="pointer-events-none fixed bottom-[max(14px,env(safe-area-inset-bottom))] right-3 z-[140] flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2 md:right-4">
        <For each={toasts()}>
          {(toast) => (
            <div
              class={`pointer-events-auto rounded-xl border px-3 py-2 shadow-[0_18px_36px_rgba(0,0,0,0.45)] backdrop-blur-sm ${toastToneClass(toast.tone)}`}
              data-testid="app-toast"
            >
              <div class="flex items-start gap-2">
                <p class="min-w-0 flex-1 text-sm leading-snug">{toast.message}</p>
                <button
                  type="button"
                  class="rounded border border-[#5f7292] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#d7e6ff] transition hover:border-[var(--accent)]"
                  onClick={() => dismiss(toast.id)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("ToastContext is not available");
  }
  return ctx;
}
