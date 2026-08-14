import { css } from "@linaria/core";
import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { FEATURES, TRUST_POINTS } from "../lib/site";

const groupedFeatures = Object.entries(
  FEATURES.reduce<Record<string, typeof FEATURES>>((groups, feature) => {
    const current = groups[feature.category] || [];
    groups[feature.category] = [...current, feature];
    return groups;
  }, {}),
);

export default function FeaturesRoute() {
  return (
    <MarketingLayout>
      <section>
        <p class={style1}>Features</p>
        <h1 class={style2}>See how Donegeon helps teams plan, prioritize, and move work.</h1>
        <p class={style3}>
          From fast capture to recurring schedules to shared board play, Donegeon is built to help teams stay organized and keep
          momentum.
        </p>
      </section>

      <section class={style4}>
        <For each={groupedFeatures}>
          {([category, items]) => (
            <div>
              <div class={style5}>
                <div>
                  <p class={style1}>{category}</p>
                  <h2 class={style6}>{category} features</h2>
                </div>
                <p class={style7}>
                  Explore the parts of the product that help teams capture work, stay aligned, and follow through.
                </p>
              </div>

              <div class={style8}>
                <For each={items}>
                  {(feature) => (
                    <article class={style9}>
                      <h3 class={style10}>{feature.title}</h3>
                      <p class={style11}>{feature.description}</p>
                      <ul class={style12}>
                        <For each={feature.bullets}>{(bullet) => <li>• {bullet}</li>}</For>
                      </ul>
                    </article>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </section>

      <section class={style13}>
        <p class={style1}>Why teams can rely on it</p>
        <h2 class={style6}>Donegeon covers the essentials teams expect as they grow.</h2>
        <div class={style14}>
          <For each={TRUST_POINTS}>
            {(item) => (
              <div class={style15}>
                {item}
              </div>
            )}
          </For>
        </div>
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
margin-top: calc(var(--spacing) * 14);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 10) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 10) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style5 = css`
margin-bottom: calc(var(--spacing) * 5);
display: flex;
align-items: flex-end;
justify-content: space-between;
gap: calc(var(--spacing) * 4);
`;

const style6 = css`
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style7 = css`
max-width: var(--container-sm);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-muted);
`;

const style8 = css`
display: grid;
gap: calc(var(--spacing) * 5);
@media (width >= 48rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
@media (width >= 80rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const style9 = css`
border-radius: 1.8rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 6);
--tw-shadow: 0 20px 40px var(--tw-shadow-color, rgba(0,0,0,0.22));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style10 = css`
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style11 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

const style12 = css`
margin-top: calc(var(--spacing) * 5);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
`;

const style13 = css`
margin-top: calc(var(--spacing) * 16);
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-image: linear-gradient(135deg,rgba(255,139,80,0.1),rgba(82,142,196,0.08) 58%,rgba(138,228,163,0.08));
padding: calc(var(--spacing) * 8);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style14 = css`
margin-top: calc(var(--spacing) * 6);
display: grid;
gap: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const style15 = css`
border-radius: 1.4rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,255,255,0.08);
background-color: rgba(12,20,30,0.7);
padding: calc(var(--spacing) * 5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-main);
`;
