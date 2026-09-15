import { css } from "@linaria/core";

type DonegeonLogoProps = {
  compact?: boolean;
  class?: string;
};

export default function DonegeonLogo(props: DonegeonLogoProps) {
  return (
    <span class={`${logo} ${props.compact ? compact : ""} ${props.class ?? ""}`}>
      Donegeon
    </span>
  );
}

const logo = css`
  position: relative;
  display: inline-block;
  color: var(--palette-hex-ff3f86-7a0916);
  font-family: "Permanent Marker", cursive;
  font-size: clamp(1.65rem, 2.2vw, 2.35rem);
  line-height: .85;
  letter-spacing: -.065em;
  text-transform: uppercase;
  transform: skew(-7deg) rotate(-1deg);
  text-shadow: 2px 2px 0 var(--palette-hex-6e1239-ad6bca), 0 0 14px var(--palette-rgba-255-32-114-35-c66dac);

  &::after {
    content: "";
    position: absolute;
    left: -.1em;
    right: -.16em;
    bottom: -.28em;
    height: .18em;
    background: var(--palette-hex-ff2072-43b6fd);
    clip-path: polygon(0 38%, 78% 0, 100% 35%, 67% 61%, 91% 100%, 0 72%);
    opacity: .9;
    filter: drop-shadow(0 0 4px var(--palette-rgba-255-32-114-5-0f2a9d));
  }
`;

const compact = css`font-size: 1.75rem;`;
