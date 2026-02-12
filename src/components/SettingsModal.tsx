import { useState } from "react";
import { DEFAULT_MODEL, type AppSettings } from "../types";

type SettingsModalProps = {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClearApiKey: () => void;
  onClose: () => void;
};

const MODEL_PRESETS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"];

function normalizeModel(model: string): string {
  return MODEL_PRESETS.includes(model) ? model : DEFAULT_MODEL;
}

export function SettingsModal({ settings, onSave, onClearApiKey, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(settings.openaiApiKey);
  const [model, setModel] = useState(normalizeModel(settings.model));

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="settings-title">設定</h2>
        <p className="modal-note">
          APIキーはブラウザのlocalStorageに平文保存されます。共有端末では使用しないでください。
        </p>

        <label htmlFor="openai-key">OpenAI APIキー</label>
        <input
          id="openai-key"
          type="text"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-..."
          autoComplete="off"
        />

        <label htmlFor="openai-model">モデル</label>
        <select
          id="openai-model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        >
          {MODEL_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
        </select>

        <div className="modal-actions">
          <button
            type="button"
            onClick={() => onSave({ openaiApiKey: apiKey.trim(), model })}
          >
            保存
          </button>
          <button type="button" className="ghost" onClick={onClearApiKey}>
            APIキーをクリア
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
