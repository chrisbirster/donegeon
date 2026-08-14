import { css } from "@linaria/core";

type BrandTaglineProps = { class?: string };

export default function BrandTagline(props: BrandTaglineProps) {
  return (
    <p class={`${tagline} ${props.class ?? ""}`}>
      <span>Turn chaos</span>
      <span>into coordination.</span>
    </p>
  );
}

const tagline = css`
  position: relative;
  display: inline-flex;
  flex-direction: column;
  width: max-content;
  max-width: 100%;
  color: #e742ff;
  font-family: "Permanent Marker", cursive;
  font-size: 1rem;
  line-height: 1.05;
  text-align: center;
  text-transform: uppercase;
  transform: rotate(-3deg);
  text-shadow: 0 0 8px rgba(196, 69, 255, .55);

  &::after {
    content: "";
    position: absolute;
    left: -5%;
    right: -12%;
    bottom: -.5rem;
    height: .36rem;
    border-top: 2px solid #c445ff;
    border-bottom: 2px solid #8a2be2;
    transform: skew(-20deg) rotate(-2deg);
    clip-path: polygon(0 18%, 91% 0, 100% 35%, 86% 55%, 96% 100%, 0 72%);
    filter: drop-shadow(0 0 4px rgba(196, 69, 255, .5));
  }
`;
