import { css } from "@linaria/core";
type TaskViewHeaderProps = {
  title: string;
  count: number;
};

export default function TaskViewHeader(props: TaskViewHeaderProps) {
  return (
    <div class={style1}>
      <h2 class={style2}>{props.title}</h2>
      <span class={style3}>{props.count} task(s)</span>
    </div>
  );
}


const style1 = css`
margin-bottom: calc(var(--spacing) * 6);
display: flex;
align-items: center;
justify-content: space-between;
`;

const style2 = css`
font-size: var(--text-4xl);
  line-height: var(--tw-leading, var(--text-4xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: -0.03em;
  letter-spacing: -0.03em;
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style3 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-dim);
`;
