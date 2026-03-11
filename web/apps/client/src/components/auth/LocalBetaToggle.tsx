import { Show } from "solid-js";

import { localBetaToggleAvailable } from "../../lib/openBeta";

type LocalBetaToggleProps = {
  openBeta: boolean;
  onToggle: (next: boolean) => void;
};

export default function LocalBetaToggle(props: LocalBetaToggleProps) {
  return (
    <Show when={localBetaToggleAvailable()}>
      <div class="fixed bottom-4 left-4 z-50 rounded-2xl border border-[#32405c] bg-[rgba(8,12,18,0.92)] px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ea3c7]">Local beta toggle</p>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            aria-pressed={props.openBeta}
            onClick={() => props.onToggle(true)}
            class={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              props.openBeta ? "bg-[#5bd08d] text-[#102117]" : "bg-[#182235] text-[#d7e5ff]"
            }`}
          >
            Open beta
          </button>
          <button
            type="button"
            aria-pressed={!props.openBeta}
            onClick={() => props.onToggle(false)}
            class={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              !props.openBeta ? "bg-[#ff8b50] text-[#1d1108]" : "bg-[#182235] text-[#d7e5ff]"
            }`}
          >
            Waitlist
          </button>
        </div>
      </div>
    </Show>
  );
}
