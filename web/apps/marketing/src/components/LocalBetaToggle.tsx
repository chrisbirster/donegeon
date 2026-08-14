import Button from "./Button";
import { css } from "@linaria/core";
import { Show } from "solid-js";

import { localBetaToggleAvailable } from "../lib/openBeta";

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
border-radius: 1.2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(8,12,18,0.94);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
--tw-shadow: 0 20px 40px var(--tw-shadow-color, rgba(0,0,0,0.35));
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
border-radius: calc(infinity * 1px);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style5 = css`
background-color: #5bd08d;
color: #102117;
`;

const style6 = css`
background-color: rgba(255,255,255,0.06);
color: var(--text-main);
`;

const style7 = css`
background-color: #ff8b50;
color: #1d1108;
`;
