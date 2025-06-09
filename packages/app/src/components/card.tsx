import { css, cx } from "@linaria/core";

export const Card = (p: { class?: string; children: any }) => (
  <div
    class={cx(
      css`
        background: var(--gray800);
        border-radius: 8px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      `,
      p.class,
    )}
  >
    {p.children}
  </div>
);
