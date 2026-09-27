import Button from "../Button";
import { css } from "@linaria/core";
import { Show } from "solid-js";

import { localBetaToggleAvailable } from "../../lib/openBeta";

type LocalBetaToggleProps = {
  openBeta: boolean;
  onToggle: (next: boolean) => void;
};

export default function LocalBetaToggle(props: LocalBetaToggleProps) {
  return (
    <Show when={localBetaToggleAvailable()}>
      <div class={style1}>
        <p class={style2}>Local beta toggle</p>
        <div class={style3}>
          <Button
            type="button"
            unstyled
            aria-pressed={props.openBeta ? "true" : "false"}
            onClick={() => props.onToggle(true)}
            class={` ${style4} ${
              props.openBeta ? style5 : style6
            }`}
          >
            Open beta
          </Button>
          <Button
            type="button"
            unstyled
            aria-pressed={!props.openBeta ? "true" : "false"}
            onClick={() => props.onToggle(false)}
            class={` ${style4} ${
              !props.openBeta ? style7 : style6
            }`}
          >
            Waitlist
          </Button>
        </div>
      </div>
    </Show>
  );
}

const style1 = css`
position: fixed;
bottom: calc(var(--spacing) * 4);
left: calc(var(--spacing) * 4);
z-index: 50;
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-overlay);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
--tw-shadow: 0 20px 40px var(--tw-shadow-color, var(--palette-rgba-0-0-0-0-22-3065b3));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
--tw-backdrop-blur: blur(8px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style2 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style3 = css`
margin-top: calc(var(--spacing) * 3);
display: flex;
gap: calc(var(--spacing) * 2);
`;

const style4 = css`
display: inline-flex;
min-height: 38px;
align-items: center;
justify-content: center;
border: 1px solid transparent;
border-radius: calc(infinity * 1px);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-family: "Bebas Neue", "IBM Plex Sans", sans-serif;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
letter-spacing: .065em;
text-transform: uppercase;
cursor: pointer;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:focus-visible {
  outline: 2px solid var(--palette-hex-00e0ff-93d32f);
  outline-offset: 3px;
}
`;

const style5 = css`
background-color: var(--success);
border-color: var(--success);
color: var(--success-contrast);
box-shadow: 0 0 16px var(--success-bg);
`;

const style6 = css`
background-color: var(--panel-soft);
border-color: var(--border-soft);
color: var(--text-soft);
`;

const style7 = css`
background-color: var(--accent);
border-color: var(--accent-soft);
color: var(--accent-contrast);
box-shadow: 0 0 16px var(--accent-wash);
`;
