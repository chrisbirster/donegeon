export default function HomeRoute() {
  return (
    <main class="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#2e5a3f_0%,#0d1523_45%,#070b13_100%)] text-[#e9f0ff]">
      <section class="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-18 md:px-10 md:py-24">
        <p class="inline-flex w-fit items-center gap-2 rounded-full border border-[#3d5d87] bg-[#10243f]/75 px-3 py-1 text-xs uppercase tracking-[0.14em] text-[#9ec6ff]">
          Donegeon
        </p>

        <div class="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:items-end">
          <div>
            <h1 class="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
              Turn Chaotic Tasks Into a Living Strategy Board
            </h1>
            <p class="mt-5 max-w-2xl text-lg text-[#b8c8e2] md:text-xl">
              Donegeon blends tasks, recurrence, deadlines, and resource management into one tactical workspace for teams.
            </p>
            <div class="mt-8 flex flex-wrap gap-3">
              <a
                class="rounded-lg bg-[#ff6a4a] px-5 py-2.5 text-sm font-semibold text-[#1a0d08] transition hover:bg-[#ff845f]"
                href="https://app.donegeon.com"
              >
                Open App
              </a>
              <a
                class="rounded-lg border border-[#36527a] bg-[#0f2037]/80 px-5 py-2.5 text-sm font-semibold text-[#d7e5ff] transition hover:border-[#4f77b0]"
                href="mailto:hello@donegeon.com"
              >
                Contact Team
              </a>
            </div>
          </div>

          <aside class="rounded-2xl border border-[#324f74] bg-[#0e1b2e]/85 p-6 shadow-[0_16px_40px_rgba(4,9,18,0.45)]">
            <p class="text-sm font-semibold uppercase tracking-[0.08em] text-[#9ec6ff]">Built For</p>
            <ul class="mt-4 space-y-2 text-sm text-[#d6e4fb]">
              <li>Recurring task workflows</li>
              <li>Priority and deadline control</li>
              <li>Gamified team execution</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
