import { type DragEvent, type KeyboardEvent, type MouseEvent, useState } from "react";
import type { SubTask, Todo } from "../types";

type TodoCardProps = {
  todo: Todo;
  subTasks: SubTask[];
  isCollapsed: boolean;
  isGenerating: boolean;
  errorMessage?: string;
  onToggleTodoCompleted: (todoId: string) => void;
  onToggleCollapsed: (todoId: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onRegenerateSubTasks: (todoId: string) => void;
  onUpdateTodoText: (todoId: string, text: string) => void;
  onToggleSubTaskCompleted: (subTaskId: string) => void;
  onDeleteSubTask: (subTaskId: string) => void;
  onUpdateSubTaskText: (subTaskId: string, text: string) => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLElement>) => void;
};

export function TodoCard({
  todo,
  subTasks,
  isCollapsed,
  isGenerating,
  errorMessage,
  onToggleTodoCompleted,
  onToggleCollapsed,
  onDeleteTodo,
  onRegenerateSubTasks,
  onUpdateTodoText,
  onToggleSubTaskCompleted,
  onDeleteSubTask,
  onUpdateSubTaskText,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TodoCardProps) {
  const [editingTodo, setEditingTodo] = useState(false);
  const [todoDraft, setTodoDraft] = useState(todo.text);
  const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
  const [subTaskDraft, setSubTaskDraft] = useState("");

  const startEditTodo = () => {
    setTodoDraft(todo.text);
    setEditingTodo(true);
  };

  const saveTodo = () => {
    onUpdateTodoText(todo.id, todoDraft);
    setEditingTodo(false);
  };

  const startEditSubTask = (subTask: SubTask) => {
    setEditingSubTaskId(subTask.id);
    setSubTaskDraft(subTask.text);
  };

  const saveSubTask = (subTaskId: string) => {
    onUpdateSubTaskText(subTaskId, subTaskDraft);
    setEditingSubTaskId(null);
    setSubTaskDraft("");
  };

  const onTodoInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveTodo();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditingTodo(false);
    }
  };

  const onSubTaskInputKeyDown = (event: KeyboardEvent<HTMLInputElement>, subTaskId: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveSubTask(subTaskId);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditingSubTaskId(null);
      setSubTaskDraft("");
    }
  };

  const onCardClick = (event: MouseEvent<HTMLElement>) => {
    if (editingTodo) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button, input, .checkbox-line, .editable-text, .edit-block, .subtask-list")) {
      return;
    }
    if (target.closest(".todo-card__header")) {
      onToggleCollapsed(todo.id);
    }
  };

  const confirmDeleteTodo = () => {
    const shouldDelete = window.confirm("この親TODOを削除しますか？");
    if (shouldDelete) {
      onDeleteTodo(todo.id);
    }
  };

  return (
    <article
      className="todo-card"
      aria-busy={isGenerating}
      onClick={onCardClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <header className="todo-card__header">
        <div className="todo-card__main">
          {editingTodo ? (
            <div className="edit-block">
              <input
                value={todoDraft}
                onChange={(event) => setTodoDraft(event.target.value)}
                onKeyDown={onTodoInputKeyDown}
                onClick={(event) => event.stopPropagation()}
                autoFocus
              />
              <div className="edit-actions">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    saveTodo();
                  }}
                >
                  保存
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingTodo(false);
                  }}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={todo.completed}
                onClick={(event) => event.stopPropagation()}
                onChange={() => onToggleTodoCompleted(todo.id)}
              />
              <span
                className={`editable-text ${todo.completed ? "is-done" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  startEditTodo();
                }}
              >
                {todo.text}
              </span>
              <span className="todo-priority-badge">P{todo.priority}</span>
            </label>
          )}
        </div>

        <div className="todo-card__actions">
          <button type="button" onClick={() => onRegenerateSubTasks(todo.id)} disabled={isGenerating}>
            {isGenerating ? "生成中..." : "子タスクを生成"}
          </button>
          <button type="button" className="danger" onClick={confirmDeleteTodo}>
            削除
          </button>
        </div>
      </header>

      {!isCollapsed ? (
        <>
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          <ul className="subtask-list">
            {subTasks.map((subTask, index) => (
              <li key={subTask.id} className="subtask-row">
                {editingSubTaskId === subTask.id ? (
                  <div className="edit-block">
                    <input
                      value={subTaskDraft}
                      onChange={(event) => setSubTaskDraft(event.target.value)}
                      onKeyDown={(event) => onSubTaskInputKeyDown(event, subTask.id)}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button type="button" onClick={() => saveSubTask(subTask.id)}>
                        保存
                      </button>
                      <button type="button" className="ghost" onClick={() => setEditingSubTaskId(null)}>
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={subTask.completed}
                      onChange={() => onToggleSubTaskCompleted(subTask.id)}
                    />
                    <span
                      className={`editable-text ${subTask.completed ? "is-done" : ""}`}
                      onClick={() => startEditSubTask(subTask)}
                    >
                      {index + 1}. {subTask.text}
                    </span>
                  </label>
                )}

                <div className="subtask-row__meta">
                  <button type="button" className="ghost" onClick={() => onDeleteSubTask(subTask.id)}>
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </article>
  );
}
