import {
  type ParentComponent,
  createContext,
  useContext,
} from "solid-js";

import { createTaskManager, type TaskAPI } from "./task-manager";

const TaskManagerContext =
  createContext<ReturnType<typeof createTaskManager>>();

export const TaskManagerProvider: ParentComponent<{ api: TaskAPI }> = (
  props,
) => {
  /* build the manager once and stash it */
  const manager = createTaskManager(props.api);

  return (
    <TaskManagerContext.Provider value={manager}>
      {props.children}
    </TaskManagerContext.Provider>
  );
};

export function useTasks() {
  const ctx = useContext(TaskManagerContext);
  if (!ctx) throw new Error("useTasks() must be used inside <TaskManagerProvider>");
  return ctx;
}
