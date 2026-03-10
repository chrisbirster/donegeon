import { A } from "@solidjs/router";
import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { docs, formatPublishDate, posts } from "../lib/content";
import { FEATURES, PLAN_LINKS, PLAN_SUMMARIES, TRUST_POINTS } from "../lib/site";

const featureHighlights = FEATURES.slice(0, 4);
const featuredDocs = docs.filter((entry) => entry.featured).slice(0, 3);
const docHighlights = featuredDocs.length > 0 ? featuredDocs : docs.slice(0, 3);
const postHighlights = posts.slice(0, 3);

export default function HomeRoute() {
  return (
    <MarketingLayout>
      <section class="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_420px] lg:items-start">
        <div>
          <p class="section-label">Donegeon marketing refresh</p>
          <h1 class="font-display max-w-4xl text-5xl font-semibold leading-[1.02] text-white md:text-7xl">
            The task system, board game, docs hub, and pricing story now live in one place.
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-soft)] md:text-xl">
            Donegeon turns task capture, recurrence, deadlines, quests, team roles, and board-state gameplay into a product
            site that finally reflects what the app actually does.
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <a
              href={PLAN_LINKS.personal}
              class="inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#1d1108] transition hover:bg-[#ff9f6d]"
            >
              Start Free
            </a>
            <A
              href="/docs"
              class="inline-flex rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] px-5 py-3 text-sm font-semibold text-[var(--text-main)] transition hover:border-[#4a6c8b] hover:bg-[rgba(255,255,255,0.08)]"
            >
              Explore docs
            </A>
          </div>

          <div class="mt-10 grid gap-4 sm:grid-cols-3">
            <div class="rounded-[1.6rem] border border-[var(--border-strong)] bg-[rgba(9,17,26,0.78)] p-5 shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              <p class="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Coverage</p>
              <p class="mt-2 font-display text-4xl font-semibold text-white">{FEATURES.length}</p>
              <p class="mt-2 text-sm text-[var(--text-soft)]">Feature areas mapped to the real app and backend.</p>
            </div>

            <div class="rounded-[1.6rem] border border-[var(--border-strong)] bg-[rgba(9,17,26,0.78)] p-5 shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              <p class="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Docs</p>
              <p class="mt-2 font-display text-4xl font-semibold text-white">{docs.length}</p>
              <p class="mt-2 text-sm text-[var(--text-soft)]">Markdown-driven guides with optional inline feature videos.</p>
            </div>

            <div class="rounded-[1.6rem] border border-[var(--border-strong)] bg-[rgba(9,17,26,0.78)] p-5 shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              <p class="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Updates</p>
              <p class="mt-2 font-display text-4xl font-semibold text-white">{posts.length}</p>
              <p class="mt-2 text-sm text-[var(--text-soft)]">Blog posts loaded from markdown instead of hardcoded JSX.</p>
            </div>
          </div>
        </div>

        <aside class="rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(18,34,51,0.95),rgba(10,18,28,0.95))] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.3)]">
          <p class="section-label">What ships now</p>
          <div class="mt-5 space-y-5">
            <div class="rounded-[1.3rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <p class="text-sm font-semibold text-white">Product narrative</p>
              <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">
                Task capture, recurrence, board gameplay, team collaboration, and compatibility surfaces are all represented.
              </p>
            </div>

            <div class="rounded-[1.3rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <p class="text-sm font-semibold text-white">Professional pages</p>
              <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">
                Features, pricing, docs, blog, FAQ, support contacts, and enterprise conversion paths are all wired into navigation.
              </p>
            </div>

            <div class="rounded-[1.3rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <p class="text-sm font-semibold text-white">Content workflow</p>
              <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">
                Docs and blog pages are generated from markdown files, with frontmatter for metadata, sorting, and optional video embeds.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section class="mt-20">
        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="section-label">Feature surface</p>
            <h2 class="font-display text-3xl font-semibold text-white md:text-4xl">Donegeon now markets the whole product.</h2>
          </div>
          <A href="/features" class="text-sm font-semibold text-[#ffd3b2] transition hover:text-white">
            View every feature
          </A>
        </div>

        <div class="mt-8 grid gap-5 md:grid-cols-2">
          <For each={featureHighlights}>
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
              <p class="section-label">Knowledge base</p>
              <h2 class="font-display text-3xl font-semibold text-white">Docs are now first-class site content.</h2>
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
              <p class="section-label">Publishing</p>
              <h2 class="font-display text-3xl font-semibold text-white">Blog posts now have a real content path.</h2>
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
          <p class="section-label">Pricing and trust</p>
          <h2 class="font-display text-3xl font-semibold text-white">Professional app basics are now covered.</h2>
          <p class="mt-3 max-w-2xl text-base leading-7 text-[var(--text-soft)]">
            Pricing explanations, plan-specific CTA flows, docs, support, and an enterprise path are now part of the same marketing surface.
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
          <p class="section-label">Why it feels complete</p>
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
    </MarketingLayout>
  );
}
