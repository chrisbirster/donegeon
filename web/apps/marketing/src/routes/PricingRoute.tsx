import { A } from "@solidjs/router";
import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { usePublicConfig } from "../context/PublicConfigContext";
import { FAQS, PLAN_SUMMARIES, PRICING_MATRIX, planHref, waitlistHref } from "../lib/site";

function PricingContent() {
  const publicConfig = usePublicConfig();

  return (
    <>
      <section class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          <p class="section-label">Pricing</p>
          <h1 class="font-display text-5xl font-semibold text-white md:text-6xl">Pricing that stays simple as your team grows.</h1>
          <p class="mt-5 max-w-3xl text-lg leading-8 text-[var(--text-soft)]">
            Start free for solo use, add collaboration when you need it, and talk to us when rollout needs more support.
          </p>
        </div>

        <aside class="rounded-[1.8rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
          <p class="section-label">What to expect</p>
          <ul class="mt-4 space-y-3 text-sm leading-7 text-[var(--text-soft)]">
            <li>• A free path for personal use</li>
            <li>• Team features when collaboration matters</li>
            <li>• Support for larger rollouts and enterprise questions</li>
          </ul>
        </aside>
      </section>

      <section class="mt-12 grid gap-5 lg:grid-cols-3">
        <For each={PLAN_SUMMARIES}>
          {(plan) => (
            <article
              class={`rounded-[2rem] border p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)] ${
                plan.featured
                  ? "border-[#5579a3] bg-[linear-gradient(180deg,rgba(18,34,51,0.97),rgba(13,23,35,0.94))]"
                  : "border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)]"
              }`}
            >
              <p class="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">{plan.name}</p>
              <h2 class="mt-4 font-display text-4xl font-semibold text-white">{plan.price}</h2>
              <p class="mt-1 text-sm text-[var(--text-muted)]">{plan.cadence}</p>
              <p class="mt-4 text-sm leading-7 text-[var(--text-soft)]">{plan.description}</p>
              <ul class="mt-6 space-y-3 text-sm text-[var(--text-main)]">
                <For each={plan.bullets}>{(bullet) => <li>• {bullet}</li>}</For>
              </ul>
              <a
                href={
                  publicConfig.openBeta || plan.name === "Enterprise"
                    ? plan.name === "Pro"
                      ? planHref("pro_trial")
                      : plan.name === "Personal"
                        ? planHref("personal")
                        : plan.href
                    : waitlistHref({
                        source: "marketing-pricing",
                        plan: plan.name === "Pro" ? "pro_trial" : "personal",
                      })
                }
                class={`mt-7 inline-flex rounded-full px-5 py-3 text-sm font-semibold transition ${
                  plan.featured
                    ? "bg-[var(--accent)] text-[#1d1108] hover:bg-[#ff9f6d]"
                    : "border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] text-[var(--text-main)] hover:border-[#4a6c8b] hover:bg-[rgba(255,255,255,0.08)]"
                }`}
              >
                {publicConfig.openBeta || plan.name === "Enterprise"
                  ? plan.ctaLabel
                  : plan.name === "Pro"
                    ? "Join Pro waitlist"
                    : "Join waitlist"}
              </a>
            </article>
          )}
        </For>
      </section>

      <section class="mt-14 rounded-[2rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="section-label">Compare plans</p>
            <h2 class="font-display text-3xl font-semibold text-white">Choose the plan that fits your team.</h2>
          </div>
          <div class="flex gap-3 text-sm text-[var(--text-muted)]">
            <A href="/features" class="transition hover:text-white">
              Product detail
            </A>
            <A href="/docs" class="transition hover:text-white">
              Docs
            </A>
          </div>
        </div>

        <div class="table-scroll mt-6 overflow-x-auto">
          <table class="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[1.5rem] border border-[rgba(255,255,255,0.08)]">
            <thead>
              <tr class="bg-[rgba(255,255,255,0.04)]">
                <th class="px-4 py-4 text-left text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Capability</th>
                <th class="px-4 py-4 text-left text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Personal</th>
                <th class="px-4 py-4 text-left text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Pro</th>
                <th class="px-4 py-4 text-left text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <For each={PRICING_MATRIX}>
                {(group) => (
                  <>
                    <tr>
                      <td colSpan="4" class="border-t border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#9fe8b4]">
                        {group.title}
                      </td>
                    </tr>
                    <For each={group.rows}>
                      {(row) => (
                        <tr class="border-t border-[rgba(255,255,255,0.08)]">
                          <td class="px-4 py-4 text-sm text-white">{row.label}</td>
                          <td class="px-4 py-4 text-sm text-[var(--text-soft)]">{row.personal}</td>
                          <td class="px-4 py-4 text-sm text-[var(--text-soft)]">{row.pro}</td>
                          <td class="px-4 py-4 text-sm text-[var(--text-soft)]">{row.enterprise}</td>
                        </tr>
                      )}
                    </For>
                  </>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </section>

      <section class="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div class="rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(255,139,80,0.1),rgba(82,142,196,0.08)_58%,rgba(138,228,163,0.08))] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
          <p class="section-label">Rollout support</p>
          <h2 class="font-display text-3xl font-semibold text-white">Get more help when your rollout goes beyond self-serve.</h2>
          <p class="mt-4 max-w-2xl text-base leading-7 text-[var(--text-soft)]">
            Compare plans, learn the product through docs, and reach out when setup, procurement, or migration needs a closer hand.
          </p>
        </div>

        <div class="rounded-[2rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
          <p class="section-label">FAQ</p>
          <div class="mt-4 space-y-4">
            <For each={FAQS}>
              {(item) => (
                <div class="rounded-[1.2rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                  <p class="font-semibold text-white">{item.question}</p>
                  <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">{item.answer}</p>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>
    </>
  );
}

export default function PricingRoute() {
  return (
    <MarketingLayout>
      <PricingContent />
    </MarketingLayout>
  );
}
