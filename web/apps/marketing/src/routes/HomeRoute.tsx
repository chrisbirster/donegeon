import { A } from "@solidjs/router";
import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { usePublicConfig } from "../context/PublicConfigContext";
import { docs, formatPublishDate, posts } from "../lib/content";
import { FEATURES, PLAN_SUMMARIES, TRUST_POINTS, planHref, waitlistHref } from "../lib/site";

const featuredDocs = docs.filter((entry) => entry.featured).slice(0, 3);
const docHighlights = featuredDocs.length > 0 ? featuredDocs : docs.slice(0, 3);
const postHighlights = posts.slice(0, 3);
const homeFeatureHighlights = [
  {
    category: "Capture",
    title: "Capture work without slowing down",
    description: "Add tasks, priorities, dates, and repeat schedules in one quick step so work gets recorded before it gets forgotten.",
    bullets: [
      "Create tasks in seconds",
      "Add due dates, deadlines, and repeat schedules",
      "Keep structure without wrestling a long form",
    ],
  },
  {
    category: "Scheduling",
    title: "Stay ahead of recurring work",
    description: "Keep weekly routines, recurring responsibilities, and follow-ups visible so nothing slips through the cracks.",
    bullets: [
      "Flexible daily, weekly, and monthly repeats",
      "A clearer view of what is coming next",
      "Less manual re-entry for repeat work",
    ],
  },
  {
    category: "Execution",
    title: "Move from list to action",
    description: "Capture everything in one place, then shift active work onto a board your team can use to make faster decisions.",
    bullets: [
      "Task lists and board play in one workflow",
      "Shared visibility into active work",
      "A better way to decide what moves next",
    ],
  },
  {
    category: "Board",
    title: "Make progress visible",
    description: "Donegeon turns active work into a living board so priorities stay clear and progress is easy to spot at a glance.",
    bullets: [
      "Drag work across a shared map",
      "Keep backlog pressure visible",
      "Give the team a board worth checking",
    ],
  },
];

function HomeContent() {
  const publicConfig = usePublicConfig();
  const heroPrimaryHref = () =>
    publicConfig.openBeta ? planHref("personal") : waitlistHref({ source: "marketing-home-hero", plan: "personal" });

  return (
    <>
      <section class="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_420px] lg:items-start">
        <div>
          <p class="section-label">Task management for teams that want clarity, momentum, and a little more fun.</p>
          <h1 class="font-display max-w-4xl text-5xl font-semibold leading-[1.02] text-white md:text-7xl">
            Turn messy work into a game your team wants to win.
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-soft)] md:text-xl">
            Donegeon combines tasks, planning, and a shared strategy board so your team can stay focused, move faster, and
            actually enjoy execution.
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <a
              href={heroPrimaryHref()}
              class="inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#1d1108] transition hover:bg-[#ff9f6d]"
            >
              {publicConfig.openBeta ? "Start Free" : "Join waitlist"}
            </a>
            <A
              href="/features"
              class="inline-flex rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] px-5 py-3 text-sm font-semibold text-[var(--text-main)] transition hover:border-[#4a6c8b] hover:bg-[rgba(255,255,255,0.08)]"
            >
              See how it works
            </A>
          </div>

          <div class="mt-10 grid gap-4 sm:grid-cols-3">
            <div class="rounded-[1.6rem] border border-[var(--border-strong)] bg-[rgba(9,17,26,0.78)] p-5 shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              <p class="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Built for planning</p>
              <p class="mt-2 font-display text-4xl font-semibold text-white">{FEATURES.length}</p>
              <p class="mt-2 text-sm text-[var(--text-soft)]">
                Feature areas covering capture, scheduling, boards, collaboration, and more.
              </p>
            </div>

            <div class="rounded-[1.6rem] border border-[var(--border-strong)] bg-[rgba(9,17,26,0.78)] p-5 shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              <p class="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Built for teamwork</p>
              <p class="mt-2 font-display text-4xl font-semibold text-white">{docs.length}</p>
              <p class="mt-2 text-sm text-[var(--text-soft)]">Guides and walkthroughs to help your team get started faster.</p>
            </div>

            <div class="rounded-[1.6rem] border border-[var(--border-strong)] bg-[rgba(9,17,26,0.78)] p-5 shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              <p class="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Built for momentum</p>
              <p class="mt-2 font-display text-4xl font-semibold text-white">{posts.length}</p>
              <p class="mt-2 text-sm text-[var(--text-soft)]">
                Product updates and ideas to keep teams learning as Donegeon grows.
              </p>
            </div>
          </div>
        </div>

        <aside class="rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(18,34,51,0.95),rgba(10,18,28,0.95))] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.3)]">
          <p class="section-label">Why teams try Donegeon</p>
          <div class="mt-5 space-y-5">
            <div class="rounded-[1.3rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <p class="text-sm font-semibold text-white">Clear planning</p>
              <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">
                Capture work quickly, organize what matters, and keep recurring responsibilities from disappearing into the backlog.
              </p>
            </div>

            <div class="rounded-[1.3rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <p class="text-sm font-semibold text-white">Shared visibility</p>
              <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">
                Lists, boards, guides, pricing, and team flows are easy to understand whether you are evaluating for yourself or a group.
              </p>
            </div>

            <div class="rounded-[1.3rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <p class="text-sm font-semibold text-white">More engaging execution</p>
              <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">
                Work feels less like maintaining a spreadsheet and more like moving a team toward a shared objective.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section class="mt-20">
        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="section-label">Everything your team needs</p>
            <h2 class="font-display text-3xl font-semibold text-white md:text-4xl">Everything your team needs to plan and execute.</h2>
          </div>
          <A href="/features" class="text-sm font-semibold text-[#ffd3b2] transition hover:text-white">
            Explore features
          </A>
        </div>

        <div class="mt-8 grid gap-5 md:grid-cols-2">
          <For each={homeFeatureHighlights}>
            {(feature) => (
              <article class="rounded-[1.8rem] border border-[var(--border-strong)] bg-[rgba(11,19,29,0.84)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
                <div class="flex items-center justify-between gap-4">
                  <p class="rounded-full bg-[rgba(138,228,163,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#9fe8b4]">
                    {feature.category}
                  </p>
                </div>
                <h3 class="mt-4 font-display text-2xl font-semibold text-white">{feature.title}</h3>
                <p class="mt-3 text-sm leading-7 text-[var(--text-soft)]">{feature.description}</p>
                <ul class="mt-5 space-y-2 text-sm text-[var(--text-main)]">
                  <For each={feature.bullets}>{(bullet) => <li>• {bullet}</li>}</For>
                </ul>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class="mt-20 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div class="rounded-[2rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
          <div class="flex items-end justify-between gap-4">
            <div>
              <p class="section-label">Learn the essentials</p>
              <h2 class="font-display text-3xl font-semibold text-white">Guides that help your team get started quickly.</h2>
            </div>
            <A href="/docs" class="text-sm font-semibold text-[#ffd3b2] transition hover:text-white">
              Browse docs
            </A>
          </div>

          <div class="mt-6 grid gap-4">
            <For each={docHighlights}>
              {(entry) => (
                <A
                  href={`/docs/${entry.slug}`}
                  class="rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 transition hover:border-[#466684] hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    <span>{entry.category}</span>
                    <span>•</span>
                    <span>{entry.readingMinutes} min read</span>
                  </div>
                  <h3 class="mt-3 font-display text-2xl font-semibold text-white">{entry.title}</h3>
                  <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">{entry.excerpt}</p>
                </A>
              )}
            </For>
          </div>
        </div>

        <div class="rounded-[2rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
          <div class="flex items-end justify-between gap-4">
            <div>
              <p class="section-label">Tips, updates, and product news</p>
              <h2 class="font-display text-3xl font-semibold text-white">Stay in the loop as the product grows.</h2>
            </div>
            <A href="/blog" class="text-sm font-semibold text-[#ffd3b2] transition hover:text-white">
              Visit blog
            </A>
          </div>

          <div class="mt-6 space-y-4">
            <For each={postHighlights}>
              {(entry) => (
                <A
                  href={`/blog/${entry.slug}`}
                  class="block rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 transition hover:border-[#466684] hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    <span>{formatPublishDate(entry.publishedAt)}</span>
                    <span>•</span>
                    <span>{entry.readingMinutes} min read</span>
                  </div>
                  <h3 class="mt-3 font-display text-2xl font-semibold text-white">{entry.title}</h3>
                  <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">{entry.excerpt}</p>
                </A>
              )}
            </For>
          </div>
        </div>
      </section>

      <section class="mt-20 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div class="rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(255,139,80,0.1),rgba(82,142,196,0.08)_58%,rgba(138,228,163,0.08))] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
          <p class="section-label">Simple pricing as you grow</p>
          <h2 class="font-display text-3xl font-semibold text-white">Start simple and add more when your team is ready.</h2>
          <p class="mt-3 max-w-2xl text-base leading-7 text-[var(--text-soft)]">
            Start free, add collaboration when it matters, and talk to us when rollout needs more support.
          </p>

          <div class="mt-7 grid gap-4 md:grid-cols-3">
            <For each={PLAN_SUMMARIES}>
              {(plan) => (
                <article
                  class={`rounded-[1.5rem] border p-5 ${
                    plan.featured
                      ? "border-[#5478a2] bg-[rgba(18,35,54,0.94)]"
                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]"
                  }`}
                >
                  <p class="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">{plan.name}</p>
                  <h3 class="mt-3 font-display text-3xl font-semibold text-white">{plan.price}</h3>
                  <p class="mt-1 text-sm text-[var(--text-muted)]">{plan.cadence}</p>
                  <p class="mt-3 text-sm leading-7 text-[var(--text-soft)]">{plan.description}</p>
                </article>
              )}
            </For>
          </div>
        </div>

        <div class="rounded-[2rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
          <p class="section-label">Why teams stick with it</p>
          <ul class="mt-5 space-y-4">
            <For each={TRUST_POINTS}>
              {(item) => (
                <li class="rounded-[1.2rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-7 text-[var(--text-main)]">
                  {item}
                </li>
              )}
            </For>
          </ul>
        </div>
      </section>
    </>
  );
}

export default function HomeRoute() {
  return (
    <MarketingLayout>
      <HomeContent />
    </MarketingLayout>
  );
}
