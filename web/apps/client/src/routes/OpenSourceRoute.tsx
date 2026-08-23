import { css } from "@linaria/core";

const SOURCE_URL = "https://github.com/chrisbirster/donegeon";
const LICENSE_URL = `${SOURCE_URL}/blob/main/LICENSE`;

export default function OpenSourceRoute() {
  return (
    <main class={page}>
      <article class={card}>
        <p class={eyebrow}>Open source</p>
        <h1 class={title}>Donegeon is AGPL-3.0-only software.</h1>
        <p class={copy}>Copyright © 2026 Chris Birster.</p>
        <p class={copy}>
          Donegeon is free software: you may redistribute it and/or modify it under the terms of the GNU Affero General
          Public License version 3. Donegeon is provided without warranty, to the extent permitted by law.
        </p>
        <p class={copy}>
          If you interact with a modified Donegeon over a network, the AGPL requires the operator to offer the
          corresponding source code for the version being run.
        </p>
        <div class={actions}>
          <a class={primary} href={SOURCE_URL} target="_blank" rel="noreferrer">
            View source code
          </a>
          <a class={secondary} href={LICENSE_URL} target="_blank" rel="noreferrer">
            Read the AGPL-3.0 license
          </a>
          <a class={secondary} href="/">
            Return to Donegeon
          </a>
        </div>
      </article>
    </main>
  );
}

const page = css`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: var(--bg, #090b12);
  color: var(--text-main, #f5f7fb);
`;

const card = css`
  width: min(46rem, 100%);
  padding: clamp(1.5rem, 5vw, 3rem);
  border: 1px solid var(--border-strong, rgba(255,255,255,.16));
  border-radius: 1.5rem;
  background: var(--panel, rgba(18,22,34,.96));
  box-shadow: 0 24px 80px rgba(0,0,0,.35);
`;

const eyebrow = css`
  margin: 0 0 .75rem;
  color: var(--accent-text, #ffae7a);
  font-size: .8rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
`;

const title = css`
  margin: 0 0 1.5rem;
  font-size: clamp(2rem, 6vw, 3.5rem);
  line-height: 1.05;
`;

const copy = css`
  margin: 0 0 1rem;
  color: var(--text-soft, #c7cedb);
  line-height: 1.7;
`;

const actions = css`
  display: flex;
  flex-wrap: wrap;
  gap: .75rem;
  margin-top: 2rem;
`;

const primary = css`
  display: inline-flex;
  align-items: center;
  padding: .75rem 1rem;
  border-radius: .75rem;
  background: var(--accent, #ff8b50);
  color: #1d1108;
  font-weight: 700;
  text-decoration: none;
`;

const secondary = css`
  display: inline-flex;
  align-items: center;
  padding: .75rem 1rem;
  border: 1px solid var(--border-strong, rgba(255,255,255,.16));
  border-radius: .75rem;
  color: var(--text-main, #f5f7fb);
  text-decoration: none;
`;
