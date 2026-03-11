import { Show } from "solid-js";

import { localBetaToggleAvailable } from "../lib/openBeta";

type LocalBetaToggleProps = {
  openBeta: boolean;
  onToggle: (next: boolean) => void;
};

export default function LocalBetaToggle(props: LocalBetaToggleProps) {
  return (
    <Show when={localBetaToggleAvailable()}>
      <div class="fixed bottom-4 left-4 z-50 rounded-[1.2rem] border border-[var(--border-strong)] bg-[rgba(8,12,18,0.94)] px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Local beta toggle</p>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            aria-pressed={props.openBeta}
            onClick={() => props.onToggle(true)}
            class={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              props.openBeta ? "bg-[#5bd08d] text-[#102117]" : "bg-[rgba(255,255,255,0.06)] text-[var(--text-main)]"
            }`}
          >
            Open beta
          </button>
          <button
            type="button"
            aria-pressed={!props.openBeta}
            onClick={() => props.onToggle(false)}
            class={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              !props.openBeta ? "bg-[#ff8b50] text-[#1d1108]" : "bg-[rgba(255,255,255,0.06)] text-[var(--text-main)]"
            }`}
          >
            Waitlist
          </button>
        </div>
      </div>
    </Show>
  );
}
