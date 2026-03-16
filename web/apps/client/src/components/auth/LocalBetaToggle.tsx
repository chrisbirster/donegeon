import { Show } from "solid-js";

import { localBetaToggleAvailable } from "../../lib/openBeta";

type LocalBetaToggleProps = {
  openBeta: boolean;
  onToggle: (next: boolean) => void;
};

export default function LocalBetaToggle(props: LocalBetaToggleProps) {
  return (
    <Show when={localBetaToggleAvailable()}>
      <div class="fixed bottom-4 left-4 z-50 rounded-2xl border border-[var(--border-strong)] bg-[rgba(6,10,16,0.92)] px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Local beta toggle</p>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            aria-pressed={props.openBeta}
            onClick={() => props.onToggle(true)}
            class={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              props.openBeta ? "bg-[var(--success)] text-[#102117]" : "bg-[rgba(255,255,255,0.03)] text-[var(--text-soft)]"
            }`}
          >
            Open beta
          </button>
          <button
            type="button"
            aria-pressed={!props.openBeta}
            onClick={() => props.onToggle(false)}
            class={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              !props.openBeta ? "bg-[var(--accent)] text-[#1d1108]" : "bg-[rgba(255,255,255,0.03)] text-[var(--text-soft)]"
            }`}
          >
            Waitlist
          </button>
        </div>
      </div>
    </Show>
  );
}
