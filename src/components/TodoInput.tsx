import { type FormEvent, useState } from "react";

type TodoInputProps = {
  onAdd: (text: string) => void;
};

export function TodoInput({ onAdd }: TodoInputProps) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = value.trim();
    if (!text) {
      return;
    }
    onAdd(text);
    setValue("");
  };

  return (
    <form className="todo-input" onSubmit={submit}>
      <input
        id="new-todo"
        name="new-todo"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="TODO"
        autoComplete="off"
      />
    </form>
  );
}
