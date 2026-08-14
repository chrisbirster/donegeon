import { css } from "@linaria/core";
import { useParams } from "@solidjs/router";
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
          <section class={style1}>
            <p class={style2}>Documentation</p>
            <h1 class={style3}>Guide not found</h1>
            <p class={style4}>That guide is not available right now.</p>
            <a
              href="/docs"
              class={style5}
            >
              Back to docs
            </a>
          </section>
        }
      >
        {(entry) => (
          <div class={style6}>
            <article class={style7}>
              <a href="/docs" class={style8}>
                ← Back to docs
              </a>

              <div class={style9}>
                <span>{entry().category}</span>
                <span>•</span>
                <span>{entry().readingMinutes} min read</span>
              </div>

              <h1 class={style10}>{entry().title}</h1>
              <p class={style11}>{entry().description || entry().excerpt}</p>

              <Show when={video()}>
                {(asset) => (
                  <section class={style12}>
                    <div class={style13}>
                      {entry().videoLabel || "Selected feature walkthrough"}
                    </div>
                    {asset().kind === "iframe" ? (
                      <iframe
                        src={asset().src}
                        title={entry().videoLabel || `${entry().title} video`}
                        class={style14}
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
                        class={style15}
                      />
                    )}
                  </section>
                )}
              </Show>

              <div class={style16}>
                <MarkdownContent html={entry().html} />
              </div>
            </article>

            <aside class={style17}>
              <div class={style18}>
                <p class={style2}>Guide details</p>
                <div class={style19}>
                  <p>
                    <span class={style20}>Category:</span> {entry().category}
                  </p>
                  <p>
                    <span class={style20}>Reading time:</span> {entry().readingMinutes} min
                  </p>
                  <Show when={entry().video}>
                    <p>
                      <span class={style20}>Media:</span> Video walkthrough included
                    </p>
                  </Show>
                </div>
              </div>

              <Show when={relatedDocs().length > 0}>
                <div class={style18}>
                  <p class={style2}>Related guides</p>
                  <div class={style21}>
                    {relatedDocs().map((item) => (
                      <a
                        href={`/docs/${item.slug}`}
                        class={style22}
                      >
                        <span class={style23}>{item.title}</span>
                        <span class={style24}>{item.readingMinutes} min read</span>
                      </a>
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


const style1 = css`
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 8);
text-align: center;
--tw-shadow: 0 20px 40px var(--tw-shadow-color, rgba(0,0,0,0.22));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style2 = css`
color: #9fe8b4; font-size: .75rem; font-weight: 700; letter-spacing: .18em; margin: 0 0 .6rem; text-transform: uppercase;
`;

const style3 = css`
font-size: var(--text-4xl);
  line-height: var(--tw-leading, var(--text-4xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style4 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-base);
  line-height: var(--tw-leading, var(--text-base--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

const style5 = css`
margin-top: calc(var(--spacing) * 6);
display: inline-flex;
border-radius: calc(infinity * 1px);
background-color: var(--accent);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #1d1108;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      background-color: #ff9f6d;
    }
  }
`;

const style6 = css`
display: grid;
gap: calc(var(--spacing) * 8);
@media (width >= 64rem) {
    grid-template-columns: minmax(0,1fr) 280px;
  }
@media (width >= 64rem) {
    align-items: flex-start;
  }
`;

const style7 = css`
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 7);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style8 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #ffd3b2;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      color: var(--color-white);
    }
  }
`;

const style9 = css`
margin-top: calc(var(--spacing) * 5);
display: flex;
flex-wrap: wrap;
align-items: center;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style10 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-4xl);
  line-height: var(--tw-leading, var(--text-4xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
@media (width >= 48rem) {
    font-size: var(--text-5xl);
    line-height: var(--tw-leading, var(--text-5xl--line-height));
  }
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style11 = css`
margin-top: calc(var(--spacing) * 4);
max-width: var(--container-3xl);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-leading: calc(var(--spacing) * 8);
  line-height: calc(var(--spacing) * 8);
color: var(--text-soft);
`;

const style12 = css`
margin-top: calc(var(--spacing) * 8);
overflow: hidden;
border-radius: 1.7rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: #08111a;
`;

const style13 = css`
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
border-color: rgba(255,255,255,0.08);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 4);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
`;

const style14 = css`
aspect-ratio: var(--aspect-video);
width: 100%;
border-style: var(--tw-border-style);
  border-width: 0px;
`;

const style15 = css`
aspect-ratio: var(--aspect-video);
width: 100%;
background-color: var(--color-black);
object-fit: cover;
`;

const style16 = css`
margin-top: calc(var(--spacing) * 10);
`;

const style17 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 5) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 5) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style18 = css`
border-radius: 1.7rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 6);
--tw-shadow: 0 20px 40px var(--tw-shadow-color, rgba(0,0,0,0.22));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style19 = css`
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

const style20 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
`;

const style21 = css`
margin-top: calc(var(--spacing) * 4);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style22 = css`
display: block;
border-radius: 1.1rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,255,255,0.08);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 4);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
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
      background-color: rgba(255,255,255,0.06);
    }
  }
`;

const style23 = css`
display: block;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
`;

const style24 = css`
margin-top: calc(var(--spacing) * 1);
display: block;
color: var(--text-muted);
`;
