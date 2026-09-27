import { css } from "@linaria/core";
import type { JSX } from "@solidjs/web";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning";
export type ButtonSize = "sm" | "md" | "lg";

type BooleanAriaValue = boolean | "true" | "false";
type ButtonAriaOverrides = {
  "aria-expanded"?: BooleanAriaValue;
  "aria-pressed"?: BooleanAriaValue | "mixed";
  "aria-selected"?: BooleanAriaValue;
  "aria-disabled"?: BooleanAriaValue;
};

export type ButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonAriaOverrides> &
  ButtonAriaOverrides & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
    iconOnly?: boolean;
    unstyled?: boolean;
  };

const variants: Record<ButtonVariant, string> = {
  primary: css`
    border-color: var(--palette-hex-c445ff-7a9c18);
    background: linear-gradient(180deg, var(--palette-hex-d04cff-83a730), var(--palette-hex-9a18dc-8cee0f));
    color: var(--palette-hex-100713-93c375);
    box-shadow: 0 3px 0 var(--palette-hex-5f137d-1ed6b9), 0 0 18px var(--palette-rgba-196-69-255-24-899fe9);
    &:hover:not(:disabled) { background: linear-gradient(180deg, var(--palette-hex-df6aff-45150a), var(--palette-hex-ad24ef-a6cf93)); box-shadow: 0 3px 0 var(--palette-hex-6d168f-83a32b), 0 0 24px var(--palette-rgba-196-69-255-38-4b7b18); }
  `,
  secondary: css`
    border-color: var(--palette-hex-8a2be2-2dbd0f);
    background: linear-gradient(180deg, var(--palette-rgba-24-28-41-98-610ffa), var(--palette-rgba-10-13-22-98-edaeaa));
    color: var(--palette-hex-f7f0e7-7eccec);
    box-shadow: inset 0 0 0 1px var(--palette-rgba-0-224-255-06-54150d);
    &:hover:not(:disabled) { border-color: var(--palette-hex-c445ff-7a9c18); color: var(--palette-hex-fff-d14f90); box-shadow: 0 0 18px var(--palette-rgba-196-69-255-22-7769cd); }
  `,
  ghost: css`
    border-color: transparent;
    background: transparent;
    color: var(--palette-hex-b5afba-eb564a);
    box-shadow: none;
    &:hover:not(:disabled) { border-color: var(--palette-rgba-196-69-255-42-dc5806); background: var(--palette-rgba-196-69-255-08-daca1e); color: var(--palette-hex-fff-d14f90); }
  `,
  danger: css`
    border-color: var(--palette-rgba-239-68-68-72-3ba697);
    background: var(--palette-rgba-68-16-24-34-3cd4f9);
    color: var(--palette-hex-ff6767-83cda6);
    box-shadow: inset 0 0 0 1px var(--palette-rgba-239-68-68-06-818ea6);
    &:hover:not(:disabled) { background: var(--palette-rgba-116-20-31-56-5e48e5); border-color: var(--palette-hex-ef4444-a29305); box-shadow: 0 0 16px var(--palette-rgba-239-68-68-2-dc5f70); }
  `,
  warning: css`
    border-color: var(--palette-rgba-255-138-0-72-5261e7);
    background: var(--palette-rgba-78-43-5-42-dec542);
    color: var(--palette-hex-ffb13b-a8378a);
    box-shadow: inset 0 0 0 1px var(--palette-rgba-255-138-0-07-04bc05);
    &:hover:not(:disabled) { background: var(--palette-rgba-116-60-3-58-9affca); border-color: var(--palette-hex-ff8a00-51eaff); box-shadow: 0 0 16px var(--palette-rgba-255-138-0-2-ccb2c7); }
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
  &:focus-visible { outline: 2px solid var(--palette-hex-00e0ff-93d32f); outline-offset: 3px; }
  &:disabled { cursor: not-allowed; opacity: .48; filter: saturate(.55); }
  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const blockClass = css`width: 100%;`;
const iconClass = css`aspect-ratio: 1; padding-inline: 0;`;
const internalProps = new Set(["variant", "size", "block", "iconOnly", "unstyled", "class"]);

function reactiveDomProps(props: ButtonProps): JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (internalProps.has(key)) continue;
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      get: () => {
        const value = (props as unknown as Record<string, unknown>)[key];
        return key.startsWith("aria-") && typeof value === "boolean" ? String(value) : value;
      },
    });
  }
  return result as JSX.ButtonHTMLAttributes<HTMLButtonElement>;
}

export default function Button(props: ButtonProps) {
  const domProps = reactiveDomProps(props);
  const className = () => [
    props.unstyled ? "" : buttonBase,
    props.unstyled ? "" : variants[props.variant ?? "secondary"],
    props.unstyled ? "" : sizes[props.size ?? "md"],
    props.block ? blockClass : "",
    props.iconOnly ? iconClass : "",
    props.class ?? "",
  ].filter(Boolean).join(" ");
  const accessibleLabel = () => {
    const explicit = props["aria-label"];
    if (explicit != null) return explicit;
    if (!props.unstyled && typeof props.children === "string") return props.children;
    return undefined;
  };

  return <button {...domProps} aria-label={accessibleLabel()} class={className()} />;
}
