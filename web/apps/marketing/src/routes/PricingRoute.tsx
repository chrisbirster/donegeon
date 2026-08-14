import { css } from "@linaria/core";
import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { usePublicConfig } from "../context/PublicConfigContext";
import { FAQS, PLAN_SUMMARIES, PRICING_MATRIX, planHref, waitlistHref } from "../lib/site";

function PricingContent() {
  const publicConfig = usePublicConfig();

  return (
    <>
      <section class={style1}>
        <div>
          <p class={style2}>Pricing</p>
          <h1 class={style3}>Pricing that stays simple as your team grows.</h1>
          <p class={style4}>
            Start free for solo use, add collaboration when you need it, and talk to us when rollout needs more support.
          </p>
        </div>

        <aside class={style5}>
          <p class={style2}>What to expect</p>
          <ul class={style6}>
            <li>• A Free path for solo use</li>
            <li>• Team features when collaboration matters</li>
            <li>• Support for larger rollouts and enterprise questions</li>
          </ul>
        </aside>
      </section>

      <section class={style7}>
        <For each={PLAN_SUMMARIES}>
          {(plan) => (
            <article
              class={` ${style8} ${
                plan.featured
                  ? style9
                  : style10
              }`}
            >
              <p class={style11}>{plan.name}</p>
              <h2 class={style12}>{plan.price}</h2>
              <p class={style13}>{plan.cadence}</p>
              <p class={style14}>{plan.description}</p>
              <ul class={style15}>
                <For each={plan.bullets}>{(bullet) => <li>• {bullet}</li>}</For>
              </ul>
              <a
                href={
                  publicConfig.openBeta || plan.id === "enterprise"
                    ? plan.loginPlan
                      ? planHref(plan.loginPlan)
                      : plan.href
                    : waitlistHref({
                        source: "marketing-pricing",
                        plan: plan.loginPlan,
                      })
                }
                class={` ${style16} ${
                  plan.featured
                    ? style17
                    : style18
                }`}
              >
                {publicConfig.openBeta || plan.id === "enterprise"
                  ? plan.ctaLabel
                  : plan.waitlistLabel}
              </a>
            </article>
          )}
        </For>
      </section>

      <section class={style19}>
        <div class={style20}>
          <div>
            <p class={style2}>Compare plans</p>
            <h2 class={style21}>Choose the plan that fits your team.</h2>
          </div>
          <div class={style22}>
            <a href="/features" class={style23}>
              Product detail
            </a>
            <a href="/docs" class={style23}>
              Docs
            </a>
          </div>
        </div>

        <div class={style24}>
          <table class={style25}>
            <thead>
              <tr class={style26}>
                <th class={style27}>Capability</th>
                <th class={style27}>Free</th>
                <th class={style27}>Pro</th>
                <th class={style27}>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <For each={PRICING_MATRIX}>
                {(group) => (
                  <>
                    <tr>
                      <td colspan="4" class={style28}>
                        {group.title}
                      </td>
                    </tr>
                    <For each={group.rows}>
                      {(row) => (
                        <tr class={style29}>
                          <td class={style30}>{row.label}</td>
                          <td class={style31}>{row.free}</td>
                          <td class={style31}>{row.pro}</td>
                          <td class={style31}>{row.enterprise}</td>
                        </tr>
                      )}
                    </For>
                  </>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </section>

      <section class={style32}>
        <div class={style33}>
          <p class={style2}>Rollout support</p>
          <h2 class={style21}>Get more help when your rollout goes beyond self-serve.</h2>
          <p class={style34}>
            Compare plans, learn the product through docs, and reach out when setup, procurement, or migration needs a closer hand.
          </p>
        </div>

        <div class={style35}>
          <p class={style2}>FAQ</p>
          <div class={style36}>
            <For each={FAQS}>
              {(item) => (
                <div class={style37}>
                  <p class={style38}>{item.question}</p>
                  <p class={style39}>{item.answer}</p>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>
    </>
  );
}

export default function PricingRoute() {
  return (
    <MarketingLayout>
      <PricingContent />
    </MarketingLayout>
  );
}


const style1 = css`
display: grid;
gap: calc(var(--spacing) * 8);
@media (width >= 64rem) {
    grid-template-columns: minmax(0,1fr) 360px;
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
margin-top: calc(var(--spacing) * 12);
display: grid;
gap: calc(var(--spacing) * 5);
@media (width >= 64rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const style8 = css`
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
padding: calc(var(--spacing) * 7);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style9 = css`
border-color: #5579a3;
background-image: linear-gradient(180deg,rgba(18,34,51,0.97),rgba(13,23,35,0.94));
`;

const style10 = css`
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
`;

const style11 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style12 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-4xl);
  line-height: var(--tw-leading, var(--text-4xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style13 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-muted);
`;

const style14 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

const style15 = css`
margin-top: calc(var(--spacing) * 6);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
`;

const style16 = css`
margin-top: calc(var(--spacing) * 7);
display: inline-flex;
border-radius: calc(infinity * 1px);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style17 = css`
background-color: var(--accent);
color: #1d1108;
&:hover {
    @media (hover: hover) {
      background-color: #ff9f6d;
    }
  }
`;

const style18 = css`
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.04);
color: var(--text-main);
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

const style19 = css`
margin-top: calc(var(--spacing) * 14);
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 7);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style20 = css`
display: flex;
align-items: flex-end;
justify-content: space-between;
gap: calc(var(--spacing) * 4);
`;

const style21 = css`
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style22 = css`
display: flex;
gap: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-muted);
`;

const style23 = css`
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      color: var(--color-white);
    }
  }
`;

const style24 = css`
margin-top: calc(var(--spacing) * 6);
overflow-x: auto;
scrollbar-color: rgba(137,160,182,.5) transparent;
`;

const style25 = css`
min-width: 100%;
border-collapse: separate;
--tw-border-spacing-x: calc(var(--spacing) * 0);
  --tw-border-spacing-y: calc(var(--spacing) * 0);
  border-spacing: var(--tw-border-spacing-x) var(--tw-border-spacing-y);
overflow: hidden;
border-radius: 1.5rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,255,255,0.08);
`;

const style26 = css`
background-color: rgba(255,255,255,0.04);
`;

const style27 = css`
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 4);
text-align: left;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style28 = css`
border-top-style: var(--tw-border-style);
  border-top-width: 1px;
border-color: rgba(255,255,255,0.08);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: #9fe8b4;
text-transform: uppercase;
`;

const style29 = css`
border-color: rgba(255,255,255,0.08);
`;

const style30 = css`
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 4);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--color-white);
`;

const style31 = css`
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 4);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style32 = css`
margin-top: calc(var(--spacing) * 14);
display: grid;
gap: calc(var(--spacing) * 6);
@media (width >= 64rem) {
    grid-template-columns: minmax(0,1fr) 340px;
  }
`;

const style33 = css`
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-image: linear-gradient(135deg,rgba(255,139,80,0.1),rgba(82,142,196,0.08) 58%,rgba(138,228,163,0.08));
padding: calc(var(--spacing) * 7);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style34 = css`
margin-top: calc(var(--spacing) * 4);
max-width: var(--container-2xl);
font-size: var(--text-base);
  line-height: var(--tw-leading, var(--text-base--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

const style35 = css`
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 7);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style36 = css`
margin-top: calc(var(--spacing) * 4);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style37 = css`
border-radius: 1.2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,255,255,0.08);
background-color: rgba(255,255,255,0.03);
padding: calc(var(--spacing) * 4);
`;

const style38 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
`;

const style39 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;
