import { A } from "@solidjs/router";

export default function BoardRoute() {
  return (
    <main class="min-h-screen p-4 md:p-10">
      <section class="mx-auto max-w-6xl rounded-3xl border border-[#2e3544] bg-[linear-gradient(180deg,#20242a,#171a1f)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] md:p-10">
        <div class="flex items-center justify-between gap-3">
          <h1 class="text-3xl font-semibold tracking-tight text-[#eff2f8]">Board</h1>
          <A
            href="/task/inbox"
            class="rounded-lg border border-[#3f4f6b] bg-[#1a2a44] px-3 py-2 text-sm text-[#d9e7ff] hover:border-[var(--accent)]"
          >
            Back to Tasks
          </A>
        </div>
        <p class="mt-3 max-w-2xl text-sm text-[#aab2c2]">
          Phase 1 route shell is in place. Next phase will pull in board state and drag/drop command flow from legacy.
        </p>
      </section>
    </main>
  );
}
