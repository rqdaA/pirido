import { useCallback, useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "../storage";
import type { AppSettings, AppState, Priority, SubTask, Todo } from "../types";

const SAVE_DEBOUNCE_MS = 200;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useAppState() {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveState(state);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state]);

  const createTodo = useCallback((text: string): string => {
    const id = newId();
    const createdAt = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      todos: {
        ...prev.todos,
        [id]: {
          id,
          text,
          priority: 0,
          completed: false,
          createdAt,
          subTaskIds: [],
        },
      },
      todoOrder: [id, ...prev.todoOrder],
    }));

    return id;
  }, []);

  const toggleTodoCompleted = useCallback((todoId: string) => {
    setState((prev) => {
      const todo = prev.todos[todoId];
      if (!todo) {
        return prev;
      }

      const nextCompleted = !todo.completed;
      let nextTodoOrder = prev.todoOrder;
      let nextSubTasks = prev.subTasks;

      if (nextCompleted) {
        const withoutTarget = prev.todoOrder.filter((id) => id !== todoId);
        const uncheckedIds = withoutTarget.filter((id) => {
          const item = prev.todos[id];
          return Boolean(item) && !item.completed;
        });
        const checkedIds = withoutTarget.filter((id) => {
          const item = prev.todos[id];
          return Boolean(item) && item.completed;
        });
        nextTodoOrder = [...uncheckedIds, todoId, ...checkedIds];

        // 親が完了したら配下の子タスクも完了扱いにする。
        if (todo.subTaskIds.length > 0) {
          nextSubTasks = { ...prev.subTasks };
          for (const subTaskId of todo.subTaskIds) {
            const subTask = nextSubTasks[subTaskId];
            if (!subTask || subTask.completed) {
              continue;
            }
            nextSubTasks[subTaskId] = {
              ...subTask,
              completed: true,
            };
          }
        }
      }

      return {
        ...prev,
        todos: {
          ...prev.todos,
          [todoId]: {
            ...todo,
            completed: nextCompleted,
          },
        },
        subTasks: nextSubTasks,
        todoOrder: nextTodoOrder,
      };
    });
  }, []);

  const deleteTodo = useCallback((todoId: string) => {
    setState((prev) => {
      const todo = prev.todos[todoId];
      if (!todo) {
        return prev;
      }

      const nextTodos = { ...prev.todos };
      delete nextTodos[todoId];

      const nextSubTasks = { ...prev.subTasks };
      for (const subTaskId of todo.subTaskIds) {
        delete nextSubTasks[subTaskId];
      }

      return {
        ...prev,
        todos: nextTodos,
        subTasks: nextSubTasks,
        todoOrder: prev.todoOrder.filter((id) => id !== todoId),
        collapsedTodoIds: prev.collapsedTodoIds.filter((id) => id !== todoId),
      };
    });
  }, []);

  const addGeneratedSubTasks = useCallback(
    (todoId: string, items: Array<{ text: string }>) => {
      if (items.length === 0) {
        return;
      }

      setState((prev) => {
        const todo = prev.todos[todoId];
        if (!todo) {
          return prev;
        }

        const nextSubTasks = { ...prev.subTasks };
        const appendedSubTaskIds: string[] = [];

        for (const item of items) {
          const id = newId();
          const createdAt = new Date().toISOString();
          const subTask: SubTask = {
            id,
            parentId: todoId,
            text: item.text.trim(),
            completed: false,
            createdAt,
            source: "ai",
          };
          nextSubTasks[id] = subTask;
          appendedSubTaskIds.push(id);
        }

        const nextTodo: Todo = {
          ...todo,
          subTaskIds: [...todo.subTaskIds, ...appendedSubTaskIds],
        };

        return {
          ...prev,
          subTasks: nextSubTasks,
          todos: {
            ...prev.todos,
            [todoId]: nextTodo,
          },
        };
      });
    },
    [],
  );

  const toggleSubTaskCompleted = useCallback((subTaskId: string) => {
    setState((prev) => {
      const target = prev.subTasks[subTaskId];
      if (!target) {
        return prev;
      }

      return {
        ...prev,
        subTasks: {
          ...prev.subTasks,
          [subTaskId]: {
            ...target,
            completed: !target.completed,
          },
        },
      };
    });
  }, []);

  const updateTodoText = useCallback((todoId: string, text: string) => {
    const nextText = text.trim();
    if (!nextText) {
      return;
    }

    setState((prev) => {
      const todo = prev.todos[todoId];
      if (!todo) {
        return prev;
      }

      return {
        ...prev,
        todos: {
          ...prev.todos,
          [todoId]: {
            ...todo,
            text: nextText,
          },
        },
      };
    });
  }, []);

  const updateSubTaskText = useCallback((subTaskId: string, text: string) => {
    const nextText = text.trim();
    if (!nextText) {
      return;
    }

    setState((prev) => {
      const target = prev.subTasks[subTaskId];
      if (!target) {
        return prev;
      }

      return {
        ...prev,
        subTasks: {
          ...prev.subTasks,
          [subTaskId]: {
            ...target,
            text: nextText,
          },
        },
      };
    });
  }, []);

  const deleteSubTask = useCallback((subTaskId: string) => {
    setState((prev) => {
      const target = prev.subTasks[subTaskId];
      if (!target) {
        return prev;
      }

      const nextSubTasks = { ...prev.subTasks };
      delete nextSubTasks[subTaskId];

      const parent = prev.todos[target.parentId];
      if (!parent) {
        return {
          ...prev,
          subTasks: nextSubTasks,
        };
      }

      return {
        ...prev,
        subTasks: nextSubTasks,
        todos: {
          ...prev.todos,
          [parent.id]: {
            ...parent,
            subTaskIds: parent.subTaskIds.filter((id) => id !== subTaskId),
          },
        },
      };
    });
  }, []);

  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...settings,
      },
    }));
  }, []);

  const clearSettings = useCallback(() => {
    setState((prev) => ({
      ...prev,
      settings: {
        openaiApiKey: "",
        model: prev.settings.model,
      },
    }));
  }, []);

  const reorderTodos = useCallback((orderedTodoIds: string[], priorities?: Record<string, Priority>) => {
    setState((prev) => {
      const existing = new Set(prev.todoOrder);
      const dedupedValid = orderedTodoIds.filter((id, index) => existing.has(id) && orderedTodoIds.indexOf(id) === index);
      const remaining = prev.todoOrder.filter((id) => !dedupedValid.includes(id));
      const nextTodos = { ...prev.todos };
      if (priorities) {
        for (const [id, priority] of Object.entries(priorities)) {
          const todo = nextTodos[id];
          if (!todo) {
            continue;
          }
          nextTodos[id] = {
            ...todo,
            priority,
          };
        }
      }
      return {
        ...prev,
        todos: nextTodos,
        todoOrder: [...dedupedValid, ...remaining],
      };
    });
  }, []);

  const moveTodoToIndex = useCallback((draggedTodoId: string, nextIndex: number) => {
    if (nextIndex < 0) {
      return;
    }

    setState((prev) => {
      const fromIndex = prev.todoOrder.indexOf(draggedTodoId);
      if (fromIndex < 0 || nextIndex > prev.todoOrder.length) {
        return prev;
      }

      const nextOrder = [...prev.todoOrder];
      nextOrder.splice(fromIndex, 1);
      const adjustedIndex = fromIndex < nextIndex ? nextIndex - 1 : nextIndex;
      nextOrder.splice(adjustedIndex, 0, draggedTodoId);

      return {
        ...prev,
        todoOrder: nextOrder,
      };
    });
  }, []);

  const toggleTodoCollapsed = useCallback((todoId: string) => {
    setState((prev) => {
      if (!prev.todos[todoId]) {
        return prev;
      }

      const isCollapsed = prev.collapsedTodoIds.includes(todoId);
      return {
        ...prev,
        collapsedTodoIds: isCollapsed
          ? prev.collapsedTodoIds.filter((id) => id !== todoId)
          : [...prev.collapsedTodoIds, todoId],
      };
    });
  }, []);

  const orderedTodos = useMemo(
    () => state.todoOrder.map((id) => state.todos[id]).filter((todo): todo is Todo => Boolean(todo)),
    [state.todoOrder, state.todos],
  );

  return {
    state,
    orderedTodos,
    createTodo,
    toggleTodoCompleted,
    deleteTodo,
    updateTodoText,
    updateSubTaskText,
    addGeneratedSubTasks,
    toggleSubTaskCompleted,
    deleteSubTask,
    updateSettings,
    clearSettings,
    reorderTodos,
    moveTodoToIndex,
    toggleTodoCollapsed,
  };
}
