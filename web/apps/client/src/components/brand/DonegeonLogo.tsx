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
  color: #ff3f86;
  font-family: "Permanent Marker", cursive;
  font-size: clamp(1.65rem, 2.2vw, 2.35rem);
  line-height: .85;
  letter-spacing: -.065em;
  text-transform: uppercase;
  transform: skew(-7deg) rotate(-1deg);
  text-shadow: 2px 2px 0 #6e1239, 0 0 14px rgba(255, 32, 114, .35);

  &::after {
    content: "";
    position: absolute;
    left: -.1em;
    right: -.16em;
    bottom: -.28em;
    height: .18em;
    background: #ff2072;
    clip-path: polygon(0 38%, 78% 0, 100% 35%, 67% 61%, 91% 100%, 0 72%);
    opacity: .9;
    filter: drop-shadow(0 0 4px rgba(255, 32, 114, .5));
  }
`;

const compact = css`font-size: 1.75rem;`;
