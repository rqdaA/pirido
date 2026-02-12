import { APP_SCHEMA_VERSION, DEFAULT_MODEL, type AppState, clampPriority } from "./types";

export const STORAGE_KEY = "pirido.app.v1";

export function createInitialState(): AppState {
  return {
    todos: {},
    subTasks: {},
    todoOrder: [],
    collapsedTodoIds: [],
    settings: {
      openaiApiKey: "",
      model: DEFAULT_MODEL,
    },
    schemaVersion: APP_SCHEMA_VERSION,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function migrateState(raw: unknown): AppState {
  if (!isObject(raw)) {
    return createInitialState();
  }

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== APP_SCHEMA_VERSION) {
    return createInitialState();
  }

  const next = createInitialState();

  if (isObject(raw.todos)) {
    const normalizedTodos: AppState["todos"] = {};
    for (const [id, value] of Object.entries(raw.todos)) {
      if (!isObject(value)) {
        continue;
      }
      normalizedTodos[id] = {
        id: typeof value.id === "string" ? value.id : id,
        text: typeof value.text === "string" ? value.text : "",
        priority: clampPriority(value.priority),
        completed: Boolean(value.completed),
        createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
        subTaskIds: Array.isArray(value.subTaskIds)
          ? value.subTaskIds.filter((subTaskId): subTaskId is string => typeof subTaskId === "string")
          : [],
      };
    }
    next.todos = normalizedTodos;
  }

  if (isObject(raw.subTasks)) {
    next.subTasks = raw.subTasks as AppState["subTasks"];
  }

  if (Array.isArray(raw.todoOrder)) {
    next.todoOrder = raw.todoOrder.filter((id): id is string => typeof id === "string");
  }

  if (Array.isArray(raw.collapsedTodoIds)) {
    next.collapsedTodoIds = raw.collapsedTodoIds.filter((id): id is string => typeof id === "string");
  }

  if (isObject(raw.settings)) {
    const key = raw.settings.openaiApiKey;
    const model = raw.settings.model;
    next.settings = {
      openaiApiKey: typeof key === "string" ? key : "",
      model: typeof model === "string" && model.trim() ? model : DEFAULT_MODEL,
    };
  }

  next.schemaVersion = APP_SCHEMA_VERSION;
  return next;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }

    return migrateState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
