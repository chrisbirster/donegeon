import { TaskManagerProvider } from './context-task-manager.tsx';
import { taskAPI } from "../server/api.ts"
import { Task } from './task.tsx';

export const TaskDashboard = () => {
  return (
    <TaskManagerProvider api={taskAPI}>
      <Task />
    </TaskManagerProvider>
  )
}

