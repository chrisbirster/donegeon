import { css, cx } from "@linaria/core";
import { Button as KBButton } from "@kobalte/core/button";
const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-radius: 6px;
  transition: background 0.15s, border 0.15s;
`;
const sizes = {
  sm: css`padding: 0.375rem 0.875rem; font-size: 0.875rem;`,
  md: css`padding: 0.5rem 1.25rem; font-size: 1rem;`,
  lg: css`padding: 0.75rem 2rem; font-size: 1.125rem;`,
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
type BtnSize = keyof typeof sizes;
type BtnVariant = keyof typeof variants;

interface ButtonProps
  extends Omit<Parameters<typeof KBButton>[0], "class"> {
  size?: BtnSize;
  variant?: BtnVariant;
  class?: string;
}

export function Button(props: ButtonProps) {
  const { size = "md", variant = "primary", class: cls, ...rest } = props;
  return (
    <KBButton
      {...rest}
      class={cx(buttonBase, sizes[size], variants[variant], cls)}
    />
  );
}
