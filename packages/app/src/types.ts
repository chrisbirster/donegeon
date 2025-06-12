export type TaskStatus = 'pending' | 'active' | 'blocked' | 'done' | 'archived';

export type Task = {
  id: number;
  title: string;
  description: string;
  dueAt: number | null;
  scheduledFor: number | null;
  repeatRule: string | null;
  status: TaskStatus;
  completedAt: number | null;
  priority: number;   // 1–5
  difficulty: number; // 1–5
  xpReward: number;
  goldReward: number;
  energyCost: number;
  parentId: number | null;
  tags: string | null;   // expected to be a JSON string
  notes: string | null;
  createdAt: number; // timestamp (ms)
  updatedAt: number; // timestamp (ms)
};
