import { useEffect, useState } from 'react';
import { sendMessage } from '../../lib/messaging';
import { getSettings, onSettingsChanged, updateSettings, type Settings } from '../../lib/storage';
import { errorMessage, type DeepPartial } from '../../lib/types';

type Toast = { kind: 'ok' | 'err'; text: string };

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [version, setVersion] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [loaded, ping] = await Promise.all([getSettings(), sendMessage({ type: 'ping' })]);
        setSettings(loaded);
        setMode(ping.mode);
        setVersion(ping.version);
      } catch (error) {
        setToast({ kind: 'err', text: errorMessage(error) });
      }
    })();
    return onSettingsChanged(setSettings);
  }, []);

  async function patch(update: DeepPartial<Settings>): Promise<void> {
    try {
      setSettings(await updateSettings(update));
    } catch (error) {
      setToast({ kind: 'err', text: errorMessage(error) });
    }
  }

  async function clearCache(): Promise<void> {
    try {
      await sendMessage({ type: 'cache:clear' });
      setToast({ kind: 'ok', text: 'Cache cleared' });
    } catch (error) {
      setToast({ kind: 'err', text: errorMessage(error) });
    }
  }

  if (!settings) {
    return <p className="muted small">Loading…</p>;
  }

  const sarvamReady = Boolean(settings.sarvam.apiKey);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        <div className="row" style={{ gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'inline-block',
            }}
          />
          <h1>Jev</h1>
        </div>
        <span className="badge">{version ? `v${version}` : 'dev'}</span>
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <div className="row">
          <span className="small muted">AI mode</span>
          <span className={`badge ${mode === 'live' ? 'good' : 'warn'}`}>
            {mode === 'live' ? 'Jev live' : 'Mock'}
          </span>
        </div>
        <div className="row">
          <span className="small muted">Fallback</span>
          <span className={`badge ${sarvamReady ? 'good' : ''}`}>
            {sarvamReady ? 'Sarvam ready' : 'Not configured'}
          </span>
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <div>
            <h2>Gmail organizer</h2>
            <p className="small muted">Auto-label and priority view</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.gmail.enabled}
              onChange={(event) => void patch({ gmail: { enabled: event.target.checked } })}
            />
            <span />
          </label>
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <div>
            <h2>LinkedIn de-slop</h2>
            <p className="small muted">Blur low-value posts</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.linkedin.enabled}
              onChange={(event) => void patch({ linkedin: { enabled: event.target.checked } })}
            />
            <span />
          </label>
        </div>

        <div className="divider" />

        <div className="field">
          <div className="row">
            <label htmlFor="threshold">Blur below</label>
            <span className="small muted">{settings.linkedin.threshold}/100</span>
          </div>
          <input
            id="threshold"
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.linkedin.threshold}
            disabled={!settings.linkedin.enabled}
            onChange={(event) =>
              void patch({ linkedin: { threshold: Number(event.target.value) } })
            }
          />
        </div>
      </div>

      {!settings.consent.dataSharingAccepted && (
        <div className="toast err">
          Data sharing not accepted. Open settings to review what leaves your browser.
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}

      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" style={{ flex: 1 }} onClick={() => void chrome.runtime.openOptionsPage()}>
          Settings
        </button>
        <button className="btn" onClick={() => void clearCache()}>
          Clear cache
        </button>
      </div>
    </div>
  );
}
