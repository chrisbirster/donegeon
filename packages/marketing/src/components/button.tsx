import { Button as KButton } from "@kobalte/core/button";
import { type ComponentProps } from "solid-js";
import { css, cx } from "@linaria/core";

const base = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-radius: 6px;
  transition: background 0.15s, border 0.15s;
`;
const sizes = {
  sm: css`padding: .375rem .875rem; font-size: .875rem;`,
  md: css`padding: .5rem 1.25rem; font-size: 1rem;`,
  lg: css`padding: .75rem 2rem; font-size: 1.125rem;`,
};
const variants = {
  primary: css`
    background: var(--primary);
    color: #fff;
    border: 1px solid transparent;
    &:hover { background: var(--primaryDark); }
  `,
  outline: css`
    background: transparent;
    border: 1px solid var(--primary);
    color: var(--primary);
    &:hover { background: var(--gray800); }
  `,
};

type KBProps = ComponentProps<typeof KButton>;
export interface ButtonProps extends KBProps {
  size?: keyof typeof sizes;
  variant?: keyof typeof variants;
}

export function Button(props: ButtonProps) {
  const { size = "md", variant = "primary", class: cls, ...rest } = props;
  return (
    <KButton
      {...rest}
      class={cx(base, sizes[size], variants[variant], cls)}
    />
  );
}
