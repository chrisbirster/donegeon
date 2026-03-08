type TaskViewHeaderProps = {
  title: string;
  count: number;
};

export default function TaskViewHeader(props: TaskViewHeaderProps) {
  return (
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-4xl font-semibold tracking-tight">{props.title}</h2>
      <span class="text-sm text-[var(--text-dim)]">{props.count} task(s)</span>
    </div>
  );
}
