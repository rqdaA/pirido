import { useState } from "react";
import { SettingsModal } from "./components/SettingsModal";
import { TodoCard } from "./components/TodoCard";
import { TodoInput } from "./components/TodoInput";
import { useAppState } from "./hooks/useAppState";
import { AppError, generateSubTasks, rankTodosByAi } from "./openai";

type GenerationState = {
  loading: boolean;
  error?: string;
};

function App() {
  const {
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
  } = useAppState();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generationStateMap, setGenerationStateMap] = useState<Record<string, GenerationState>>({});
  const [isRankingTodos, setIsRankingTodos] = useState(false);
  const [rankTodosError, setRankTodosError] = useState<string | undefined>(undefined);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const getSubTasksForTodo = (todoId: string) => {
    const todo = state.todos[todoId];
    if (!todo) {
      return [];
    }

    return todo.subTaskIds
      .map((subTaskId) => state.subTasks[subTaskId])
      .filter((subTask): subTask is (typeof state.subTasks)[string] => Boolean(subTask));
  };

  const requireApiKeyOrOpenSettings = (onMissingMessage: (message: string) => void): string | null => {
    const apiKey = state.settings.openaiApiKey.trim();
    if (apiKey) {
      return apiKey;
    }
    onMissingMessage("APIキーが未設定です。設定からOpenAI APIキーを保存してください。");
    setSettingsOpen(true);
    return null;
  };

  const startGenerate = async (todoId: string) => {
    const todo = state.todos[todoId];
    if (!todo) {
      return;
    }

    const apiKey = requireApiKeyOrOpenSettings((message) => {
      setGenerationStateMap((prev) => ({
        ...prev,
        [todoId]: { loading: false, error: message },
      }));
    });

    if (!apiKey) {
      return;
    }

    setGenerationStateMap((prev) => ({
      ...prev,
      [todoId]: { loading: true },
    }));

    try {
      const existingSubTaskTexts = todo.subTaskIds
        .map((id) => state.subTasks[id]?.text)
        .filter((text): text is string => Boolean(text));

      const generated = await generateSubTasks({
        apiKey,
        model: state.settings.model,
        parentTodoText: todo.text,
        existingSubTaskTexts,
      });

      addGeneratedSubTasks(todoId, generated);
      setGenerationStateMap((prev) => ({
        ...prev,
        [todoId]: { loading: false },
      }));
    } catch (error) {
      const message =
        error instanceof AppError ? error.message : "子タスク生成に失敗しました。再試行してください。";

      setGenerationStateMap((prev) => ({
        ...prev,
        [todoId]: { loading: false, error: message },
      }));
    }
  };

  const startRankTodos = async () => {
    const activeTodos = orderedTodos.filter((todo) => !todo.completed);
    if (activeTodos.length <= 1) {
      return;
    }

    const apiKey = requireApiKeyOrOpenSettings((message) => {
      setRankTodosError(message);
    });

    if (!apiKey) {
      return;
    }

    setIsRankingTodos(true);
    setRankTodosError(undefined);

    try {
      const orderedIds = await rankTodosByAi({
        apiKey,
        model: state.settings.model,
        todos: activeTodos.map((todo) => ({ id: todo.id, text: todo.text })),
      });
      reorderTodos(orderedIds.orderedIds, orderedIds.priorities);
    } catch (error) {
      const message =
        error instanceof AppError ? error.message : "親タスクの並び替えに失敗しました。再試行してください。";

      setRankTodosError(message);
    } finally {
      setIsRankingTodos(false);
    }
  };

  const todoCards = orderedTodos.map((todo) => ({
    todo,
    subTasks: getSubTasksForTodo(todo.id),
    generationState: generationStateMap[todo.id] ?? { loading: false },
  }));
  const activeTodoCount = orderedTodos.filter((todo) => !todo.completed).length;

  const onAddTodo = (text: string) => {
    const todoId = createTodo(text);
    void startGenerate(todoId);
  };

  const onTodoDragStart = (todoId: string) => {
    setDraggingTodoId(todoId);
    setDragOverIndex(null);
  };

  const clearDragState = () => {
    setDraggingTodoId(null);
    setDragOverIndex(null);
  };

  const onTodoDropToIndex = (index: number) => {
    if (!draggingTodoId) {
      return;
    }
    moveTodoToIndex(draggingTodoId, index);
  };

  const makeDropZoneHandlers = (index: number) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!draggingTodoId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      onTodoDropToIndex(index);
      clearDragState();
    },
  });

  return (
    <>
      <div className="app-shell">
        <header className="app-header">
          <h1>Pirido</h1>
          <div className="header-actions">
            <button type="button" onClick={() => void startRankTodos()} disabled={isRankingTodos || activeTodoCount <= 1}>
              {isRankingTodos ? "並び替え中..." : "AI優先順位"}
            </button>
            <button type="button" className="ghost" onClick={() => setSettingsOpen(true)}>
              設定
            </button>
          </div>
        </header>

        {rankTodosError ? <p className="error-text">{rankTodosError}</p> : null}

        <TodoInput onAdd={onAddTodo} />

        <main className="todo-list-area">
          {todoCards.length === 0 ? <p className="empty-state">TODOを追加しましょう</p> : null}

          {todoCards.map(({ todo, subTasks, generationState }, index) => (
            <div key={todo.id} className="todo-dnd-block">
              <div
                className={`todo-drop-zone ${dragOverIndex === index ? "is-active" : ""}`}
                {...makeDropZoneHandlers(index)}
              />
              <TodoCard
                todo={todo}
                subTasks={subTasks}
                isCollapsed={state.collapsedTodoIds.includes(todo.id)}
                isGenerating={generationState.loading}
                errorMessage={generationState.error}
                onToggleTodoCompleted={toggleTodoCompleted}
                onToggleCollapsed={toggleTodoCollapsed}
                onDeleteTodo={deleteTodo}
                onRegenerateSubTasks={(todoId) => void startGenerate(todoId)}
                onUpdateTodoText={updateTodoText}
                onToggleSubTaskCompleted={toggleSubTaskCompleted}
                onDeleteSubTask={deleteSubTask}
                onUpdateSubTaskText={updateSubTaskText}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", todo.id);
                  onTodoDragStart(todo.id);
                }}
                onDragOver={(event) => {
                  if (!draggingTodoId || draggingTodoId === todo.id) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  onTodoDropToIndex(index);
                  clearDragState();
                }}
                onDragEnd={clearDragState}
              />
            </div>
          ))}
          {todoCards.length > 0 ? (
            <div
              className={`todo-drop-zone ${dragOverIndex === todoCards.length ? "is-active" : ""}`}
              {...makeDropZoneHandlers(todoCards.length)}
            />
          ) : null}
        </main>
      </div>

      {settingsOpen ? (
        <SettingsModal
          settings={state.settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(nextSettings) => {
            updateSettings(nextSettings);
            setSettingsOpen(false);
          }}
          onClearApiKey={clearSettings}
        />
      ) : null}
    </>
  );
}

export default App;
