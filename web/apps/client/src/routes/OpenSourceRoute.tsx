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
  background: var(--bg, var(--palette-hex-090b12-0bb840));
  color: var(--text-main, var(--palette-hex-f5f7fb-fcca35));
`;

const card = css`
  width: min(46rem, 100%);
  padding: clamp(1.5rem, 5vw, 3rem);
  border: 1px solid var(--border-strong, var(--palette-rgba-255-255-255-16-ae5def));
  border-radius: 1.5rem;
  background: var(--panel, var(--palette-rgba-18-22-34-96-3cee69));
  box-shadow: 0 24px 80px var(--palette-rgba-0-0-0-35-630345);
`;

const eyebrow = css`
  margin: 0 0 .75rem;
  color: var(--accent-text, var(--palette-hex-ffae7a-19bae2));
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
  color: var(--text-soft, var(--palette-hex-c7cedb-23f9aa));
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
  background: var(--accent, var(--palette-hex-ff8b50-43fd80));
  color: var(--palette-hex-1d1108-4dcb94);
  font-weight: 700;
  text-decoration: none;
`;

const secondary = css`
  display: inline-flex;
  align-items: center;
  padding: .75rem 1rem;
  border: 1px solid var(--border-strong, var(--palette-rgba-255-255-255-16-ae5def));
  border-radius: .75rem;
  color: var(--text-main, var(--palette-hex-f5f7fb-fcca35));
  text-decoration: none;
`;
