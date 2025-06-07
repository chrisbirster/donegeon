import { Menubar } from "@kobalte/core/menubar";
import { type ComponentProps } from "solid-js";
import { css, cx } from "@linaria/core";
import { ChevronDown } from "lucide-solid";

const itemBase = css`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray500);
  cursor: pointer;
  transition: color 0.15s;
  &:hover { color: #fff; }
`;

export function NavRoot(props: ComponentProps<typeof Menubar>) {
  return <Menubar{...props} />;
}

export function NavItem(props: ComponentProps<typeof Menubar.Item>) {
  return <Menubar.Item {...props} class={cx(itemBase, props.class)} />;
}

export function NavParent(props: ComponentProps<typeof Menubar.Trigger>) {
  const { children, ...rest } = props;
  return (
    <Menubar.Trigger {...rest} class={cx(itemBase, props.class)}>
      {children} <ChevronDown size={14} />
    </Menubar.Trigger>
  );
}
