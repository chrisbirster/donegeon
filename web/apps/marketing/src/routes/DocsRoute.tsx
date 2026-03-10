import { A } from "@solidjs/router";
import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { docs } from "../lib/content";

const groupedDocs = Object.entries(
  docs.reduce<Record<string, typeof docs>>((groups, entry) => {
    const current = groups[entry.category] || [];
    groups[entry.category] = [...current, entry];
    return groups;
  }, {}),
);

export default function DocsRoute() {
  return (
    <MarketingLayout>
      <section class="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_360px] lg:items-start">
        <div>
          <p class="section-label">Documentation</p>
          <h1 class="font-display text-5xl font-semibold text-white md:text-6xl">Docs now come from markdown, not hardcoded components.</h1>
          <p class="mt-5 max-w-3xl text-lg leading-8 text-[var(--text-soft)]">
            Guides are grouped by workflow so product updates can land in marketing content without touching route JSX each time.
          </p>
        </div>

        <aside class="rounded-[1.8rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
          <p class="section-label">Content model</p>
          <ul class="mt-4 space-y-3 text-sm leading-7 text-[var(--text-soft)]">
            <li>• Markdown file per guide</li>
            <li>• Frontmatter for title, category, ordering, and featured state</li>
            <li>• Optional inline video support for selected feature walkthroughs</li>
          </ul>
        </aside>
      </section>

      <section class="mt-14 space-y-10">
        <For each={groupedDocs}>
          {([category, items]) => (
            <div>
              <div class="mb-5">
                <p class="section-label">{category}</p>
                <h2 class="font-display text-3xl font-semibold text-white">{category} guides</h2>
              </div>

              <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <For each={items}>
                  {(entry) => (
                    <A
                      href={`/docs/${entry.slug}`}
                      class="rounded-[1.8rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)] transition hover:border-[#466684] hover:bg-[rgba(15,24,35,0.9)]"
                    >
                      <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        <span>{entry.readingMinutes} min read</span>
                        {entry.video ? (
                          <>
                            <span>•</span>
                            <span>Video walkthrough</span>
                          </>
                        ) : null}
                      </div>
                      <h3 class="mt-4 font-display text-2xl font-semibold text-white">{entry.title}</h3>
                      <p class="mt-3 text-sm leading-7 text-[var(--text-soft)]">{entry.excerpt}</p>
                    </A>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </section>
    </MarketingLayout>
  );
}
