export type Priority = 0 | 1 | 2 | 3 | 4 | 5;

export type SubTask = {
  id: string;
  parentId: string;
  text: string;
  completed: boolean;
  createdAt: string;
  source: "ai";
};

export type Todo = {
  id: string;
  text: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
  subTaskIds: string[];
};

export type AppSettings = {
  openaiApiKey: string;
  model: string;
};

export type AppState = {
  todos: Record<string, Todo>;
  subTasks: Record<string, SubTask>;
  todoOrder: string[];
  collapsedTodoIds: string[];
  settings: AppSettings;
  schemaVersion: 1;
};

export const APP_SCHEMA_VERSION = 1;
export const DEFAULT_MODEL = "gpt-4.1-mini";

export function clampPriority(value: unknown): Priority {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 0;
  }
  if (parsed <= 0) {
    return 0;
  }
  if (parsed <= 1) {
    return 1;
  }
  if (parsed >= 5) {
    return 5;
  }
  return parsed as Priority;
}
