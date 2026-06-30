import { useState } from "react";
import { setProvider } from "../../lib/storage";
import { ensureHostPermission, PROVIDER_META } from "../../lib/providers";
import type { ProviderConfig, ProviderId } from "../../types";

interface ApiKeySetupProps {
  /** Existing config (edit mode); null in first-time setup mode. */
  initialConfig?: ProviderConfig | null;
  onSaved: () => void;
  onCancel?: () => void;
}

/** Setup / edit screen for the AI provider and its API key. */
export function ApiKeySetup({ initialConfig = null, onSaved, onCancel }: ApiKeySetupProps) {
  const [id, setId] = useState<ProviderId>(initialConfig?.id ?? "gemini");
  const [apiKey, setApiKeyValue] = useState(initialConfig?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "");
  const [model, setModel] = useState(initialConfig?.model ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = PROVIDER_META.find((entry) => entry.id === id) ?? PROVIDER_META[0];
  const trimmedKey = apiKey.trim();
  const canSave = trimmedKey !== "" && !saving;

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const config: ProviderConfig = { id, apiKey: trimmedKey };
      if (meta.showEndpointFields) {
        if (baseUrl.trim() !== "") {
          config.baseUrl = baseUrl.trim();
        }
        if (model.trim() !== "") {
          config.model = model.trim();
        }
      }

      const granted = await ensureHostPermission(config);
      if (!granted) {
        setError("Permission to reach that endpoint was denied.");
        return;
      }

      await setProvider(config);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="setup">
      <h1 className="setup__title">Setup</h1>
      <p className="setup__desc">
        Choose an AI provider and enter its API key. It is stored only locally in your browser.
      </p>

      <select
        className="setup__input"
        value={id}
        onChange={(event) => setId(event.target.value as ProviderId)}
      >
        {PROVIDER_META.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>

      <input
        className="setup__input"
        type="password"
        placeholder={meta.keyPlaceholder}
        value={apiKey}
        autoFocus
        onChange={(event) => setApiKeyValue(event.target.value)}
      />

      {meta.showEndpointFields && (
        <>
          <input
            className="setup__input"
            type="text"
            placeholder={`Base URL (default: ${meta.defaultBaseUrl ?? ""})`}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
          <input
            className="setup__input"
            type="text"
            placeholder={`Model (default: ${meta.defaultModel})`}
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
        </>
      )}

      <p className="setup__hint">
        {meta.keyHint}
        {meta.apiKeyUrl && (
          <>
            {" "}
            <a className="setup__link" href={meta.apiKeyUrl} target="_blank" rel="noreferrer">
              Get a key
            </a>
            .
          </>
        )}
      </p>

      {error !== "" && <p className="popup__error">{error}</p>}

      <div className="setup__actions">
        <button className="btn btn--primary" disabled={!canSave} onClick={() => void handleSave()}>
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
