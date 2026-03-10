import { A } from "@solidjs/router";

import MarketingLayout from "../components/MarketingLayout";

export default function NotFoundRoute() {
  return (
    <MarketingLayout>
      <section class="rounded-[2rem] border border-[var(--border-strong)] bg-[rgba(11,20,30,0.84)] p-8 text-center shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
        <p class="section-label">404</p>
        <h1 class="font-display text-4xl font-semibold text-white md:text-5xl">That page is not part of this dungeon.</h1>
        <p class="mt-4 text-base leading-7 text-[var(--text-soft)]">
          Use the site navigation to get back to the product overview, docs, blog, or pricing.
        </p>
        <div class="mt-7 flex justify-center gap-3">
          <A
            href="/"
            class="inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#1d1108] transition hover:bg-[#ff9f6d]"
          >
            Back home
          </A>
          <A
            href="/docs"
            class="inline-flex rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] px-5 py-3 text-sm font-semibold text-[var(--text-main)] transition hover:border-[#4a6c8b] hover:bg-[rgba(255,255,255,0.08)]"
          >
            Read docs
          </A>
        </div>
      </section>
    </MarketingLayout>
  );
}
