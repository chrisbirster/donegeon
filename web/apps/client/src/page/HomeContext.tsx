import { createContext, useContext, type ParentProps } from "solid-js";
import type { Task } from "../server/api";
import type { HomeController } from "./HomeController";

const HomeContext = createContext<HomeController>();

const MANUAL_SORT_ORDER_CEILING = 1_000_000_000;

function presentationSort(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    const aManual = Math.abs(a.sortOrder) < MANUAL_SORT_ORDER_CEILING;
    const bManual = Math.abs(b.sortOrder) < MANUAL_SORT_ORDER_CEILING;

    // Freshly captured tasks use timestamp-like sort orders. Keep that block newest-first.
    // Once a user drags tasks, their compact 1..n order remains authoritative.
    if (aManual !== bManual) return aManual ? 1 : -1;
    if (a.sortOrder !== b.sortOrder) {
      return aManual ? a.sortOrder - b.sortOrder : b.sortOrder - a.sortOrder;
    }
    return a.content.localeCompare(b.content);
  });
}

export function HomeProvider(props: ParentProps<{ value: HomeController }>) {
  return <HomeContext value={props.value}>{props.children}</HomeContext>;
}

export function useHome() {
  const value = useContext(HomeContext);

  const visibleTasks = () => presentationSort(value.visibleTasks());
  const visibleCompletedTasks = () => presentationSort(value.visibleCompletedTasks());
  const searchResults = () => {
    const query = value.searchText().trim().toLowerCase();
    if (!query) return [] as Task[];

    return presentationSort(
      value.openTasks().filter((task) => {
        const projectName = task.projectId ? value.projectMap().get(task.projectId)?.name ?? task.projectId : "";
        const labels = (task.labels ?? []).join(" ");
        return (
          task.content.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          projectName.toLowerCase().includes(query) ||
          labels.toLowerCase().includes(query)
        );
      }),
    );
  };

  const viewTitle = () => (value.viewTitle() === "Upcomming" ? "Upcoming" : value.viewTitle());

  function onDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    const sourceId = value.dragTaskId() ?? event.dataTransfer?.getData("text/plain") ?? null;
    if (!sourceId || sourceId === targetId) {
      value.setDragTaskId(null);
      value.setDropTargetId(null);
      return;
    }

    value.setTasks((current) => {
      const source = current.find((item) => item.id === sourceId);
      const target = current.find((item) => item.id === targetId);
      if (!source || !target || source.isDeleted || target.isDeleted || source.checked !== target.checked) {
        return current;
      }

      const group = presentationSort(
        current.filter((item) => !item.isDeleted && item.checked === source.checked),
      );
      const sourceIndex = group.findIndex((item) => item.id === sourceId);
      const targetIndex = group.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;

      const reordered = [...group];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      const normalized = reordered.map((item, index) => ({ ...item, sortOrder: index + 1 }));
      const replacement = new Map(normalized.map((item) => [item.id, item]));

      void Promise.all(
        normalized.map((item, index) => value.api.tasks.update(item.id, { sortOrder: index + 1 })),
      ).catch(() => void value.refreshData());

      return current.map((item) => replacement.get(item.id) ?? item);
    });

    value.setDragTaskId(null);
    value.setDropTargetId(null);
  }

  return {
    ...value,
    visibleTasks,
    visibleCompletedTasks,
    searchResults,
    viewTitle,
    // These were useful while developing the scheduling audit, but they are not product UI.
    detailDueStoredValue: () => "",
    detailDeadlineStoredValue: () => "",
    onDrop,
  };
}
