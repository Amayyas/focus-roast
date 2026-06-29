import { useEffect, useState } from "react";
import { ScoreGauge } from "./components/ScoreGauge";
import { RoastDisplay } from "./components/RoastDisplay";
import { HistoryChart } from "./components/HistoryChart";
import { ApiKeySetup } from "./components/ApiKeySetup";
import { getStorage, subscribe } from "../lib/storage";
import type { RuntimeResponse, StorageShape } from "../types";

export function Popup() {
  const [storage, setStorage] = useState<StorageShape | null>(null);
  const [scanning, setScanning] = useState(false);
  const [editingKey, setEditingKey] = useState(false);

  useEffect(() => {
    void getStorage().then(setStorage);
    return subscribe(setStorage);
  }, []);

  async function handleScan(): Promise<void> {
    setScanning(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "SCAN_NOW",
      })) as RuntimeResponse;
      // Storage is updated by the worker; the subscription refreshes the UI.
      if (!response.ok) {
        // The error is also persisted by the worker (lastError); nothing to do here.
      }
    } finally {
      setScanning(false);
    }
  }

  if (storage === null) {
    return <div className="popup popup--loading">Loading…</div>;
  }

  if (storage.apiKey === "" || editingKey) {
    return (
      <div className="popup">
        <ApiKeySetup
          initialKey={storage.apiKey}
          onSaved={() => setEditingKey(false)}
          onCancel={editingKey ? () => setEditingKey(false) : undefined}
        />
      </div>
    );
  }

  const { lastResult, lastError, history } = storage;

  return (
    <div className="popup">
      <header className="popup__header">
        <h1 className="popup__title">Focus Roast</h1>
        <button
          className="iconbtn"
          title="Edit API key"
          onClick={() => setEditingKey(true)}
        >
          ⚙
        </button>
      </header>

      {lastResult ? (
        <>
          <ScoreGauge score={lastResult.score} />
          <RoastDisplay
            roast={lastResult.roast}
            categories={lastResult.categories}
            timestamp={lastResult.timestamp}
          />
        </>
      ) : (
        <p className="popup__empty">
          No scan yet. Run one to discover your score.
        </p>
      )}

      {lastError && <p className="popup__error">{lastError}</p>}

      <HistoryChart history={history} />

      <button className="btn btn--primary btn--block" disabled={scanning} onClick={() => void handleScan()}>
        {scanning ? "Scanning…" : "Scan now"}
      </button>
    </div>
  );
}
