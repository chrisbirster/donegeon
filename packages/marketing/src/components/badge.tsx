import { Badge as KBadge } from "@kobalte/core/badge";
import { type ComponentProps } from "solid-js";
import { css, cx } from "@linaria/core";

const style = css`
  background: var(--gray800);
  color: var(--primary);
  font-weight: 600;
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

export function Badge(props: ComponentProps<typeof KBadge>) {
  return <KBadge{...props} class={cx(style, props.class)} />;
}
