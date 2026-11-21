import { useEffect, useState } from 'react';
import type { GmailMessageMeta, GmailStatus } from '../../lib/gmail/types';
import { sendMessage } from '../../lib/messaging';
import { getSettings, updateSettings, type Settings } from '../../lib/storage';
import { errorMessage } from '../../lib/types';

type Toast = { kind: 'ok' | 'err'; text: string };

export default function App() {
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [testing, setTesting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [recent, setRecent] = useState<GmailMessageMeta[] | null>(null);
  const [gmailBusy, setGmailBusy] = useState(false);

  useEffect(() => {
    void getSettings().then((settings) => {
      setDraft(settings);
      setSaved(settings);
    });
    void sendMessage({ type: 'gmail:status' })
      .then(setGmailStatus)
      .catch(() => undefined);
  }, []);

  const setJev = (value: Partial<Settings['jev']>): void =>
    setDraft((prev) => prev && { ...prev, jev: { ...prev.jev, ...value } });
  const setSarvam = (value: Partial<Settings['sarvam']>): void =>
    setDraft((prev) => prev && { ...prev, sarvam: { ...prev.sarvam, ...value } });
  const setGmail = (value: Partial<Settings['gmail']>): void =>
    setDraft((prev) => prev && { ...prev, gmail: { ...prev.gmail, ...value } });
  const setLinkedin = (value: Partial<Settings['linkedin']>): void =>
    setDraft((prev) => prev && { ...prev, linkedin: { ...prev.linkedin, ...value } });
  const setConsent = (value: Partial<Settings['consent']>): void =>
    setDraft((prev) => prev && { ...prev, consent: { ...prev.consent, ...value } });

  async function save(): Promise<void> {
    if (!draft) return;
    try {
      const next = await updateSettings(draft);
      setDraft(next);
      setSaved(next);
      setToast({ kind: 'ok', text: 'Settings saved' });
    } catch (error) {
      setToast({ kind: 'err', text: errorMessage(error) });
    }
  }

  async function testConnection(): Promise<void> {
    setTesting(true);
    try {
      const ping = await sendMessage({ type: 'ping' });
      setToast({
        kind: 'ok',
        text: `Background worker OK · v${ping.version} · ${ping.mode} mode`,
      });
    } catch (error) {
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setTesting(false);
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

  async function connectGmail(): Promise<void> {
    if (!draft) return;
    setGmailBusy(true);
    try {
      // Persist the client ID before the background reads it.
      const next = await updateSettings(draft);
      setDraft(next);
      setSaved(next);
      const result = await sendMessage({ type: 'gmail:connect' });
      setGmailStatus({ connected: true, email: result.email, clientIdConfigured: true });
      setToast({ kind: 'ok', text: `Connected ${result.email ?? 'Gmail'}` });
    } catch (error) {
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setGmailBusy(false);
    }
  }

  async function disconnectGmail(): Promise<void> {
    setGmailBusy(true);
    try {
      await sendMessage({ type: 'gmail:disconnect' });
      setGmailStatus((previous) => ({
        connected: false,
        email: null,
        clientIdConfigured: previous?.clientIdConfigured ?? true,
      }));
      setRecent(null);
      setToast({ kind: 'ok', text: 'Gmail disconnected' });
    } catch (error) {
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setGmailBusy(false);
    }
  }

  async function loadRecent(): Promise<void> {
    setGmailBusy(true);
    try {
      const result = await sendMessage({ type: 'gmail:recent', limit: 10 });
      setRecent(result.messages);
    } catch (error) {
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setGmailBusy(false);
    }
  }

  if (!draft) return <p className="muted">Loading…</p>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <header className="row">
        <div>
          <h1>Jev settings</h1>
          <p className="muted small">Keys stay in this browser. Nothing is committed to the repo.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => void testConnection()} disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button className="btn primary" onClick={() => void save()} disabled={!dirty}>
            Save
          </button>
        </div>
      </header>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}

      <section className="card section">
        <div>
          <h2>Jev API</h2>
          <p className="muted small">
            Primary classifier. With mock mode on, deterministic local rules stand in for the API.
          </p>
        </div>
        <div className="field">
          <label htmlFor="jev-base">Base URL</label>
          <input
            id="jev-base"
            placeholder="https://api.jev.example"
            value={draft.jev.baseUrl}
            onChange={(event) => setJev({ baseUrl: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="jev-key">API key</label>
          <input
            id="jev-key"
            type="password"
            placeholder="jev_…"
            value={draft.jev.apiKey}
            onChange={(event) => setJev({ apiKey: event.target.value })}
          />
        </div>
        <div className="row">
          <div>
            <h2>Mock mode</h2>
            <p className="muted small">Use local heuristics instead of calling the API.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.jev.mock}
              onChange={(event) => setJev({ mock: event.target.checked })}
            />
            <span />
          </label>
        </div>
      </section>

      <section className="card section">
        <div>
          <h2>Sarvam fallback</h2>
          <p className="muted small">
            Used only when Jev is unavailable or returns low confidence.
          </p>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="sarvam-base">Base URL</label>
            <input
              id="sarvam-base"
              value={draft.sarvam.baseUrl}
              onChange={(event) => setSarvam({ baseUrl: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="sarvam-model">Model</label>
            <input
              id="sarvam-model"
              value={draft.sarvam.model}
              onChange={(event) => setSarvam({ model: event.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="sarvam-key">API key</label>
          <input
            id="sarvam-key"
            type="password"
            placeholder="sk_…"
            value={draft.sarvam.apiKey}
            onChange={(event) => setSarvam({ apiKey: event.target.value })}
          />
        </div>
      </section>

      <section className="card section">
        <div className="row">
          <div>
            <h2>Gmail organizer</h2>
            <p className="muted small">Auto-label recent mail and build a priority view.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.gmail.enabled}
              onChange={(event) => setGmail({ enabled: event.target.checked })}
            />
            <span />
          </label>
        </div>

        <div className="row">
          <div>
            <h2>Connection</h2>
            <p className="muted small">
              {gmailStatus?.connected
                ? `Connected as ${gmailStatus.email ?? 'unknown account'}`
                : gmailStatus?.clientIdConfigured
                  ? 'Not connected'
                  : 'Add a client ID below, then connect'}
            </p>
          </div>
          {gmailStatus?.connected ? (
            <button
              className="btn danger"
              onClick={() => void disconnectGmail()}
              disabled={gmailBusy}
            >
              Disconnect
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => void connectGmail()}
              disabled={gmailBusy || !draft.gmail.clientId}
            >
              {gmailBusy ? 'Connecting…' : 'Connect Gmail'}
            </button>
          )}
        </div>

        {gmailStatus?.connected && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => void loadRecent()} disabled={gmailBusy}>
              {gmailBusy ? 'Loading…' : 'Load recent mail'}
            </button>
            {recent && <span className="small muted">{recent.length} messages</span>}
          </div>
        )}

        {recent && recent.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            {recent.map((message) => (
              <div key={message.id} className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                <span
                  className="small"
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {message.subject}
                </span>
                <span
                  className="small muted"
                  style={{
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {message.from}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="field">
          <label htmlFor="gmail-client">OAuth client ID</label>
          <input
            id="gmail-client"
            placeholder="1234567890-abc.apps.googleusercontent.com"
            value={draft.gmail.clientId}
            onChange={(event) => setGmail({ clientId: event.target.value })}
          />
          <p className="muted small">
            Authorized redirect URI:{' '}
            <code style={{ userSelect: 'all' }}>{chrome.identity.getRedirectURL()}</code>
          </p>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="gmail-days">Lookback (days)</label>
            <input
              id="gmail-days"
              type="number"
              min={1}
              max={90}
              value={draft.gmail.lookbackDays}
              onChange={(event) => setGmail({ lookbackDays: Number(event.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="gmail-max">Max messages per run</label>
            <input
              id="gmail-max"
              type="number"
              min={10}
              max={1000}
              step={10}
              value={draft.gmail.maxMessages}
              onChange={(event) => setGmail({ maxMessages: Number(event.target.value) })}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <h2>Auto-label</h2>
            <p className="muted small">Apply Jev/* labels. Never archives or deletes.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.gmail.autoLabel}
              onChange={(event) => setGmail({ autoLabel: event.target.checked })}
            />
            <span />
          </label>
        </div>
        <div className="field">
          <div className="row">
            <label htmlFor="gmail-priority">Priority threshold</label>
            <span className="small muted">{draft.gmail.priorityThreshold}/100</span>
          </div>
          <input
            id="gmail-priority"
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.gmail.priorityThreshold}
            onChange={(event) => setGmail({ priorityThreshold: Number(event.target.value) })}
          />
        </div>
      </section>

      <section className="card section">
        <div className="row">
          <div>
            <h2>LinkedIn de-slop</h2>
            <p className="muted small">Blur posts that score below the threshold.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.linkedin.enabled}
              onChange={(event) => setLinkedin({ enabled: event.target.checked })}
            />
            <span />
          </label>
        </div>
        <div className="field">
          <div className="row">
            <label htmlFor="li-threshold">Blur below</label>
            <span className="small muted">{draft.linkedin.threshold}/100</span>
          </div>
          <input
            id="li-threshold"
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.linkedin.threshold}
            onChange={(event) => setLinkedin({ threshold: Number(event.target.value) })}
          />
        </div>
        <div className="row">
          <div>
            <h2>Pause on LinkedIn</h2>
            <p className="muted small">Temporarily stop scoring without disabling the extension.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.linkedin.paused}
              onChange={(event) => setLinkedin({ paused: event.target.checked })}
            />
            <span />
          </label>
        </div>
        <div className="row">
          <div>
            <h2>Debug overlay</h2>
            <p className="muted small">
              Show a live diagnostic pill on LinkedIn and log scoring details to the console.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.linkedin.debug}
              onChange={(event) => setLinkedin({ debug: event.target.checked })}
            />
            <span />
          </label>
        </div>
      </section>

      <section className="card section">
        <div>
          <h2>Privacy</h2>
          <p className="muted small">
            Email metadata (sender, subject, snippet) and LinkedIn post text are sent to the Jev API,
            and to Sarvam when the fallback is used. Full email bodies are never sent. No analytics.
          </p>
        </div>
        <label className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <input
            type="checkbox"
            checked={draft.consent.dataSharingAccepted}
            onChange={(event) => setConsent({ dataSharingAccepted: event.target.checked })}
          />
          <span className="small">I understand and accept this data sharing.</span>
        </label>
      </section>

      <footer className="row">
        <button className="btn danger" onClick={() => void clearCache()}>
          Clear cached scores
        </button>
        <button className="btn primary" onClick={() => void save()} disabled={!dirty}>
          Save settings
        </button>
      </footer>
    </div>
  );
}
