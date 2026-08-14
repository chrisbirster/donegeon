import { css } from "@linaria/core";
type MarkdownContentProps = {
  html: string;
};

export default function MarkdownContent(props: MarkdownContentProps) {
  return <div class={style1} innerHTML={props.html} />;
}


const style1 = css`
color: var(--text-soft); font-size: 1rem; line-height: 1.85; & > :first-child { margin-top: 0; } & > :last-child { margin-bottom: 0; } & h1, & h2, & h3, & h4 { color: white; font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif; line-height: 1.15; margin: 2.2rem 0 1rem; } & h1 { font-size: 2.4rem; } & h2 { font-size: 1.8rem; } & h3 { font-size: 1.35rem; } & p, & ul, & ol, & pre, & blockquote, & table { margin: 1rem 0 1.2rem; } & ul, & ol { padding-left: 1.35rem; } & a { color: #ffd4b5; text-decoration: underline; } & code { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: .45rem; padding: .12rem .4rem; } & pre { background: #07111a; border: 1px solid rgba(119,155,187,.22); border-radius: 1rem; overflow-x: auto; padding: 1rem 1.1rem; }
`;
