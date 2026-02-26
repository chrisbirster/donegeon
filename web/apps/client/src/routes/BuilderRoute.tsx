import AppShell from "../components/AppShell";

export default function BuilderRoute() {
  return (
    <AppShell activeView="builder">
      <section class="flex h-full items-center justify-center p-6">
        <div class="w-full max-w-xl rounded-2xl border border-[#2c3648] bg-[#111926] p-6 text-center">
          <p class="text-xs uppercase tracking-[0.14em] text-[#93a3bf]">Builder</p>
          <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">Coming Soon</h1>
          <p class="mt-3 text-sm text-[#b0bfd9]">
            Builder tools will live here. The mobile tab and navigation are ready.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
