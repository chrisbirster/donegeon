import { css } from "@linaria/core";

import MarketingLayout from "../components/MarketingLayout";

export default function NotFoundRoute() {
  return (
    <MarketingLayout>
      <section class={style1}>
        <p class={style2}>404</p>
        <h1 class={style3}>That page is not part of this dungeon.</h1>
        <p class={style4}>
          Use the site navigation to get back to the product overview, docs, blog, or pricing.
        </p>
        <div class={style5}>
          <a
            href="/"
            class={style6}
          >
            Back home
          </a>
          <a
            href="/docs"
            class={style7}
          >
            Read docs
          </a>
        </div>
      </section>
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
@media (width >= 48rem) {
    font-size: var(--text-5xl);
    line-height: var(--tw-leading, var(--text-5xl--line-height));
  }
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
margin-top: calc(var(--spacing) * 7);
display: flex;
justify-content: center;
gap: calc(var(--spacing) * 3);
`;

const style6 = css`
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

const style7 = css`
display: inline-flex;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.04);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #4a6c8b;
    }
  }
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.08);
    }
  }
`;
