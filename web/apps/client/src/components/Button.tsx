import { css } from "@linaria/core";
import type { JSX } from "@solidjs/web";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconOnly?: boolean;
  unstyled?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: css`
    border-color: #c445ff;
    background: linear-gradient(180deg, #d04cff, #9a18dc);
    color: #100713;
    box-shadow: 0 3px 0 #5f137d, 0 0 18px rgba(196, 69, 255, .24);
    &:hover:not(:disabled) { background: linear-gradient(180deg, #df6aff, #ad24ef); box-shadow: 0 3px 0 #6d168f, 0 0 24px rgba(196, 69, 255, .38); }
  `,
  secondary: css`
    border-color: #8a2be2;
    background: linear-gradient(180deg, rgba(24, 28, 41, .98), rgba(10, 13, 22, .98));
    color: #f7f0e7;
    box-shadow: inset 0 0 0 1px rgba(0, 224, 255, .06);
    &:hover:not(:disabled) { border-color: #c445ff; color: #fff; box-shadow: 0 0 18px rgba(196, 69, 255, .22); }
  `,
  ghost: css`
    border-color: transparent;
    background: transparent;
    color: #b5afba;
    box-shadow: none;
    &:hover:not(:disabled) { border-color: rgba(196, 69, 255, .42); background: rgba(196, 69, 255, .08); color: #fff; }
  `,
  danger: css`
    border-color: rgba(239, 68, 68, .72);
    background: rgba(68, 16, 24, .34);
    color: #ff6767;
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, .06);
    &:hover:not(:disabled) { background: rgba(116, 20, 31, .56); border-color: #ef4444; box-shadow: 0 0 16px rgba(239, 68, 68, .2); }
  `,
  warning: css`
    border-color: rgba(255, 138, 0, .72);
    background: rgba(78, 43, 5, .42);
    color: #ffb13b;
    box-shadow: inset 0 0 0 1px rgba(255, 138, 0, .07);
    &:hover:not(:disabled) { background: rgba(116, 60, 3, .58); border-color: #ff8a00; box-shadow: 0 0 16px rgba(255, 138, 0, .2); }
  `,
};

const sizes: Record<ButtonSize, string> = {
  sm: css`min-height: 30px; padding: .3rem .65rem; font-size: .75rem;`,
  md: css`min-height: 38px; padding: .5rem .9rem; font-size: .875rem;`,
  lg: css`min-height: 48px; padding: .7rem 1.2rem; font-size: 1rem;`,
};

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font-family: "Bebas Neue", "IBM Plex Sans", sans-serif;
  font-weight: 700;
  letter-spacing: .065em;
  line-height: 1;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 150ms ease, background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  &:active:not(:disabled) { transform: translateY(1px); }
  &:focus-visible { outline: 2px solid #00e0ff; outline-offset: 3px; }
  &:disabled { cursor: not-allowed; opacity: .48; filter: saturate(.55); }
  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const blockClass = css`width: 100%;`;
const iconClass = css`aspect-ratio: 1; padding-inline: 0;`;

export default function Button(props: ButtonProps) {
  const variant = () => props.variant ?? "secondary";
  const size = () => props.size ?? "md";
  const buttonProps = { ...props } as ButtonProps;
  delete buttonProps.variant;
  delete buttonProps.size;
  delete buttonProps.block;
  delete buttonProps.iconOnly;
  delete buttonProps.unstyled;
  delete buttonProps.class;
  const className = () => [
    props.unstyled ? "" : buttonBase,
    props.unstyled ? "" : variants[variant()],
    props.unstyled ? "" : sizes[size()],
    props.block ? blockClass : "",
    props.iconOnly ? iconClass : "",
    props.class ?? "",
  ].filter(Boolean).join(" ");

  return <button {...buttonProps} class={className()} />;
}
