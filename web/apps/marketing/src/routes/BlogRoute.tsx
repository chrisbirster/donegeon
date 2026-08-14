import { css } from "@linaria/core";
import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { formatPublishDate, posts } from "../lib/content";

const featuredPost = posts.find((entry) => entry.featured) || posts[0];
const remainingPosts = posts.filter((entry) => entry.slug !== featuredPost?.slug);

export default function BlogRoute() {
  return (
    <MarketingLayout>
      <section>
        <p class={style1}>Blog</p>
        <h1 class={style2}>Ideas, updates, and lessons from building Donegeon.</h1>
        <p class={style3}>
          Read product announcements, workflow ideas, and practical notes on how teams can get more out of Donegeon.
        </p>
      </section>

      {featuredPost ? (
        <section class={style4}>
          <a
            href={`/blog/${featuredPost.slug}`}
            class={style5}
          >
            <div class={style6}>
              <span>{featuredPost.category}</span>
              <span>•</span>
              <span>{formatPublishDate(featuredPost.publishedAt)}</span>
              <span>•</span>
              <span>{featuredPost.readingMinutes} min read</span>
            </div>
            <h2 class={style7}>{featuredPost.title}</h2>
            <p class={style8}>{featuredPost.excerpt}</p>
          </a>
        </section>
      ) : null}

      <section class={style9}>
        <For each={remainingPosts}>
          {(entry) => (
            <a
              href={`/blog/${entry.slug}`}
              class={style10}
            >
              <div class={style11}>
                <span>{entry.category}</span>
                <span>•</span>
                <span>{formatPublishDate(entry.publishedAt)}</span>
              </div>
              <h3 class={style12}>{entry.title}</h3>
              <p class={style13}>{entry.excerpt}</p>
              <p class={style14}>{entry.readingMinutes} min read</p>
            </a>
          )}
        </For>
      </section>
    </MarketingLayout>
  );
}


const style1 = css`
color: #9fe8b4; font-size: .75rem; font-weight: 700; letter-spacing: .18em; margin: 0 0 .6rem; text-transform: uppercase;
`;

const style2 = css`
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

const style3 = css`
margin-top: calc(var(--spacing) * 5);
max-width: var(--container-3xl);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-leading: calc(var(--spacing) * 8);
  line-height: calc(var(--spacing) * 8);
color: var(--text-soft);
`;

const style4 = css`
margin-top: calc(var(--spacing) * 12);
`;

const style5 = css`
display: block;
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-image: linear-gradient(135deg,rgba(255,139,80,0.1),rgba(82,142,196,0.08) 58%,rgba(138,228,163,0.08));
padding: calc(var(--spacing) * 8);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #507394;
    }
  }
`;

const style6 = css`
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

const style7 = css`
margin-top: calc(var(--spacing) * 4);
max-width: var(--container-4xl);
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

const style8 = css`
margin-top: calc(var(--spacing) * 4);
max-width: var(--container-3xl);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-leading: calc(var(--spacing) * 8);
  line-height: calc(var(--spacing) * 8);
color: var(--text-soft);
`;

const style9 = css`
margin-top: calc(var(--spacing) * 12);
display: grid;
gap: calc(var(--spacing) * 5);
@media (width >= 48rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
@media (width >= 80rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const style10 = css`
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

const style11 = css`
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

const style12 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style13 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

const style14 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #ffd3b2;
text-transform: uppercase;
`;
