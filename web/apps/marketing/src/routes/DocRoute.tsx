import { A, useParams } from "@solidjs/router";
import { Show, createMemo } from "solid-js";

import MarkdownContent from "../components/MarkdownContent";
import MarketingLayout from "../components/MarketingLayout";
import { docs, getDocBySlug, resolveVideoAsset } from "../lib/content";

export default function DocRoute() {
  const params = useParams();
  const currentSlug = createMemo(() => params.slug ?? "");
  const doc = createMemo(() => getDocBySlug(currentSlug()));
  const video = createMemo(() => resolveVideoAsset(doc()?.video));
  const relatedDocs = createMemo(() =>
    docs.filter((entry) => entry.slug !== currentSlug() && entry.category === doc()?.category).slice(0, 3),
  );

  return (
    <MarketingLayout>
      <Show
        when={doc()}
        fallback={
          <section class="rounded-[2rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-8 text-center shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
            <p class="section-label">Documentation</p>
            <h1 class="font-display text-4xl font-semibold text-white">Guide not found</h1>
            <p class="mt-4 text-base leading-7 text-[var(--text-soft)]">That guide is not available right now.</p>
            <A
              href="/docs"
              class="mt-6 inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#1d1108] transition hover:bg-[#ff9f6d]"
            >
              Back to docs
            </A>
          </section>
        }
      >
        {(entry) => (
          <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <article class="rounded-[2rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.24)]">
              <A href="/docs" class="text-sm font-semibold text-[#ffd3b2] transition hover:text-white">
                ← Back to docs
              </A>

              <div class="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <span>{entry().category}</span>
                <span>•</span>
                <span>{entry().readingMinutes} min read</span>
              </div>

              <h1 class="mt-4 font-display text-4xl font-semibold text-white md:text-5xl">{entry().title}</h1>
              <p class="mt-4 max-w-3xl text-lg leading-8 text-[var(--text-soft)]">{entry().description || entry().excerpt}</p>

              <Show when={video()}>
                {(asset) => (
                  <section class="mt-8 overflow-hidden rounded-[1.7rem] border border-[var(--border-strong)] bg-[#08111a]">
                    <div class="border-b border-[rgba(255,255,255,0.08)] px-5 py-4 text-sm font-semibold text-white">
                      {entry().videoLabel || "Selected feature walkthrough"}
                    </div>
                    {asset().kind === "iframe" ? (
                      <iframe
                        src={asset().src}
                        title={entry().videoLabel || `${entry().title} video`}
                        class="aspect-video w-full border-0"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                      />
                    ) : (
                      <video
                        src={asset().src}
                        poster={entry().videoPoster}
                        controls
                        preload="metadata"
                        class="aspect-video w-full bg-black object-cover"
                      />
                    )}
                  </section>
                )}
              </Show>

              <div class="mt-10">
                <MarkdownContent html={entry().html} />
              </div>
            </article>

            <aside class="space-y-5">
              <div class="rounded-[1.7rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
                <p class="section-label">Guide details</p>
                <div class="mt-4 space-y-3 text-sm leading-7 text-[var(--text-soft)]">
                  <p>
                    <span class="font-semibold text-white">Category:</span> {entry().category}
                  </p>
                  <p>
                    <span class="font-semibold text-white">Reading time:</span> {entry().readingMinutes} min
                  </p>
                  <Show when={entry().video}>
                    <p>
                      <span class="font-semibold text-white">Media:</span> Video walkthrough included
                    </p>
                  </Show>
                </div>
              </div>

              <Show when={relatedDocs().length > 0}>
                <div class="rounded-[1.7rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
                  <p class="section-label">Related guides</p>
                  <div class="mt-4 space-y-3">
                    {relatedDocs().map((item) => (
                      <A
                        href={`/docs/${item.slug}`}
                        class="block rounded-[1.1rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm transition hover:border-[#466684] hover:bg-[rgba(255,255,255,0.06)]"
                      >
                        <span class="block font-semibold text-white">{item.title}</span>
                        <span class="mt-1 block text-[var(--text-muted)]">{item.readingMinutes} min read</span>
                      </A>
                    ))}
                  </div>
                </div>
              </Show>
            </aside>
          </div>
        )}
      </Show>
    </MarketingLayout>
  );
}
