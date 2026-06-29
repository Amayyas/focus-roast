import { useState } from "react";
import { setApiKey } from "../../lib/storage";

interface ApiKeySetupProps {
  /** Existing key (edit mode); empty in first-time setup mode. */
  initialKey?: string;
  onSaved: () => void;
  onCancel?: () => void;
}

/** Setup / edit screen for the Gemini API key. */
export function ApiKeySetup({ initialKey = "", onSaved, onCancel }: ApiKeySetupProps) {
  const [value, setValue] = useState(initialKey);
  const [saving, setSaving] = useState(false);

  const trimmed = value.trim();
  const looksValid = trimmed.startsWith("AIza");

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      await setApiKey(trimmed);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="setup">
      <h1 className="setup__title">Setup</h1>
      <p className="setup__desc">
        Enter your Google Gemini API key to enable scoring. It is stored
        only locally in your browser.
      </p>
      <input
        className="setup__input"
        type="password"
        placeholder="AIza..."
        value={value}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
      />
      {trimmed !== "" && !looksValid && (
        <p className="setup__hint">A Gemini key usually starts with “AIza”.</p>
      )}
      <div className="setup__actions">
        <button
          className="btn btn--primary"
          disabled={trimmed === "" || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button className="btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
