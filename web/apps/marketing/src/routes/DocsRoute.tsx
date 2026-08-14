import { css } from "@linaria/core";
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
      <section class={style1}>
        <div>
          <p class={style2}>Documentation</p>
          <h1 class={style3}>Guides that help your team get productive faster.</h1>
          <p class={style4}>
            Start with capture, scheduling, boards, and collaboration. These guides explain how Donegeon works in day-to-day use.
          </p>
        </div>

        <aside class={style5}>
          <p class={style2}>What you'll find</p>
          <ul class={style6}>
            <li>• Quick-start guides by workflow</li>
            <li>• Explanations for key features and team setup</li>
            <li>• Video walkthroughs on selected guides</li>
          </ul>
        </aside>
      </section>

      <section class={style7}>
        <For each={groupedDocs}>
          {([category, items]) => (
            <div>
              <div class={style8}>
                <p class={style2}>{category}</p>
                <h2 class={style9}>{category} guides</h2>
              </div>

              <div class={style10}>
                <For each={items}>
                  {(entry) => (
                    <a
                      href={`/docs/${entry.slug}`}
                      class={style11}
                    >
                      <div class={style12}>
                        <span>{entry.readingMinutes} min read</span>
                        {entry.video ? (
                          <>
                            <span>•</span>
                            <span>Video walkthrough</span>
                          </>
                        ) : null}
                      </div>
                      <h3 class={style13}>{entry.title}</h3>
                      <p class={style14}>{entry.excerpt}</p>
                    </a>
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


const style1 = css`
display: grid;
gap: calc(var(--spacing) * 8);
@media (width >= 64rem) {
    grid-template-columns: minmax(0,1.05fr) 360px;
  }
@media (width >= 64rem) {
    align-items: flex-start;
  }
`;

const style2 = css`
color: #9fe8b4; font-size: .75rem; font-weight: 700; letter-spacing: .18em; margin: 0 0 .6rem; text-transform: uppercase;
`;

const style3 = css`
font-size: var(--text-5xl);
  line-height: var(--tw-leading, var(--text-5xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
@media (width >= 48rem) {
    font-size: var(--text-6xl);
    line-height: var(--tw-leading, var(--text-6xl--line-height));
  }
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style4 = css`
margin-top: calc(var(--spacing) * 5);
max-width: var(--container-3xl);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-leading: calc(var(--spacing) * 8);
  line-height: calc(var(--spacing) * 8);
color: var(--text-soft);
`;

const style5 = css`
border-radius: 1.8rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 6);
--tw-shadow: 0 20px 40px var(--tw-shadow-color, rgba(0,0,0,0.22));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style6 = css`
margin-top: calc(var(--spacing) * 4);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

const style7 = css`
margin-top: calc(var(--spacing) * 14);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 10) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 10) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style8 = css`
margin-bottom: calc(var(--spacing) * 5);
`;

const style9 = css`
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style10 = css`
display: grid;
gap: calc(var(--spacing) * 5);
@media (width >= 48rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
@media (width >= 80rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const style11 = css`
border-radius: 1.8rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 6);
--tw-shadow: 0 20px 40px var(--tw-shadow-color, rgba(0,0,0,0.22));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #466684;
    }
  }
&:hover {
    @media (hover: hover) {
      background-color: rgba(15,24,35,0.9);
    }
  }
`;

const style12 = css`
display: flex;
flex-wrap: wrap;
align-items: center;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style13 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style14 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;
