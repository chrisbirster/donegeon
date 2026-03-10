import { A } from "@solidjs/router";
import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { formatPublishDate, posts } from "../lib/content";

const featuredPost = posts.find((entry) => entry.featured) || posts[0];
const remainingPosts = posts.filter((entry) => entry.slug !== featuredPost?.slug);

export default function BlogRoute() {
  return (
    <MarketingLayout>
      <section>
        <p class="section-label">Blog</p>
        <h1 class="font-display text-5xl font-semibold text-white md:text-6xl">Product updates and operational writing, also from markdown.</h1>
        <p class="mt-5 max-w-3xl text-lg leading-8 text-[var(--text-soft)]">
          Use this space for launches, release context, migration stories, and deeper explainers around how Donegeon works.
        </p>
      </section>

      {featuredPost ? (
        <section class="mt-12">
          <A
            href={`/blog/${featuredPost.slug}`}
            class="block rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(255,139,80,0.1),rgba(82,142,196,0.08)_58%,rgba(138,228,163,0.08))] p-8 shadow-[0_24px_50px_rgba(0,0,0,0.24)] transition hover:border-[#507394]"
          >
            <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <span>{featuredPost.category}</span>
              <span>•</span>
              <span>{formatPublishDate(featuredPost.publishedAt)}</span>
              <span>•</span>
              <span>{featuredPost.readingMinutes} min read</span>
            </div>
            <h2 class="mt-4 max-w-4xl font-display text-4xl font-semibold text-white md:text-5xl">{featuredPost.title}</h2>
            <p class="mt-4 max-w-3xl text-lg leading-8 text-[var(--text-soft)]">{featuredPost.excerpt}</p>
          </A>
        </section>
      ) : null}

      <section class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <For each={remainingPosts}>
          {(entry) => (
            <A
              href={`/blog/${entry.slug}`}
              class="rounded-[1.8rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)] transition hover:border-[#466684] hover:bg-[rgba(15,24,35,0.9)]"
            >
              <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <span>{entry.category}</span>
                <span>•</span>
                <span>{formatPublishDate(entry.publishedAt)}</span>
              </div>
              <h3 class="mt-4 font-display text-2xl font-semibold text-white">{entry.title}</h3>
              <p class="mt-3 text-sm leading-7 text-[var(--text-soft)]">{entry.excerpt}</p>
              <p class="mt-4 text-xs uppercase tracking-[0.12em] text-[#ffd3b2]">{entry.readingMinutes} min read</p>
            </A>
          )}
        </For>
      </section>
    </MarketingLayout>
  );
}
