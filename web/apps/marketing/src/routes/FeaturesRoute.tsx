import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { FEATURES, TRUST_POINTS } from "../lib/site";

const groupedFeatures = Object.entries(
  FEATURES.reduce<Record<string, typeof FEATURES>>((groups, feature) => {
    const current = groups[feature.category] || [];
    groups[feature.category] = [...current, feature];
    return groups;
  }, {}),
);

export default function FeaturesRoute() {
  return (
    <MarketingLayout>
      <section>
        <p class="section-label">Features</p>
        <h1 class="font-display text-5xl font-semibold text-white md:text-6xl">See how Donegeon helps teams plan, prioritize, and move work.</h1>
        <p class="mt-5 max-w-3xl text-lg leading-8 text-[var(--text-soft)]">
          From fast capture to recurring schedules to shared board play, Donegeon is built to help teams stay organized and keep
          momentum.
        </p>
      </section>

      <section class="mt-14 space-y-10">
        <For each={groupedFeatures}>
          {([category, items]) => (
            <div>
              <div class="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p class="section-label">{category}</p>
                  <h2 class="font-display text-3xl font-semibold text-white">{category} features</h2>
                </div>
                <p class="max-w-sm text-sm leading-7 text-[var(--text-muted)]">
                  Explore the parts of the product that help teams capture work, stay aligned, and follow through.
                </p>
              </div>

              <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <For each={items}>
                  {(feature) => (
                    <article class="rounded-[1.8rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
                      <h3 class="font-display text-2xl font-semibold text-white">{feature.title}</h3>
                      <p class="mt-3 text-sm leading-7 text-[var(--text-soft)]">{feature.description}</p>
                      <ul class="mt-5 space-y-2 text-sm text-[var(--text-main)]">
                        <For each={feature.bullets}>{(bullet) => <li>• {bullet}</li>}</For>
                      </ul>
                    </article>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </section>

      <section class="mt-16 rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(255,139,80,0.1),rgba(82,142,196,0.08)_58%,rgba(138,228,163,0.08))] p-8 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
        <p class="section-label">Why teams can rely on it</p>
        <h2 class="font-display text-3xl font-semibold text-white">Donegeon covers the essentials teams expect as they grow.</h2>
        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <For each={TRUST_POINTS}>
            {(item) => (
              <div class="rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(12,20,30,0.7)] p-5 text-sm leading-7 text-[var(--text-main)]">
                {item}
              </div>
            )}
          </For>
        </div>
      </section>
    </MarketingLayout>
  );
}
