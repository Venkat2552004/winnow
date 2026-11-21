import { useEffect, useState, type CSSProperties } from 'react';
import type { GmailStatus, PriorityEntry } from '../../lib/gmail/types';
import { CATEGORY_SHORT } from '../../lib/jev/types';
import {
  DIAGNOSE_MESSAGE,
  PROBE_MESSAGE,
  TEST_BLUR_MESSAGE,
  type LinkedInDiagnostics,
  type TestBlurResult,
} from '../../lib/linkedin/diagnostics';
import type { DomProbe } from '../../lib/linkedin/probe';
import { sendMessage } from '../../lib/messaging';
import { getTodayStats, type DayStats } from '../../lib/stats';
import { getSettings, onSettingsChanged, updateSettings, type Settings } from '../../lib/storage';
import { errorMessage, type DeepPartial } from '../../lib/types';
import { Aurora } from '../../lib/ui/Aurora';
import { ScoreRing } from '../../lib/ui/ScoreRing';
import { SignalMark } from '../../lib/ui/SignalMark';
import { categoryHue, glowVars } from '../../lib/ui/generative';

type Toast = { kind: 'ok' | 'err'; text: string };

const vars = (values: Record<string, string | number>): CSSProperties =>
  values as CSSProperties;

function StatusRow({ label, value, hue }: { label: string; value: string; hue: number }) {
  return (
    <div className="row">
      <span className="small muted">{label}</span>
      <span className="badge" data-hue style={vars({ '--badge-hue': hue })}>
        <span className="dot" style={vars({ '--dot-hue': hue })} />
        {value}
      </span>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [diag, setDiag] = useState<LinkedInDiagnostics | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [probe, setProbe] = useState<DomProbe | null>(null);
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [version, setVersion] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [priority, setPriority] = useState<PriorityEntry[] | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [loaded, ping, today] = await Promise.all([
          getSettings(),
          sendMessage({ type: 'ping' }),
          getTodayStats(),
        ]);
        setSettings(loaded);
        setMode(ping.mode);
        setVersion(ping.version);
        setStats(today);
      } catch (error) {
        setToast({ kind: 'err', text: errorMessage(error) });
      }
    })();
    void loadPriority();
    void sendMessage({ type: 'gmail:status' })
      .then(setGmailStatus)
      .catch(() => undefined);
    return onSettingsChanged(setSettings);
  }, []);

  async function loadPriority(): Promise<void> {
    try {
      const result = await sendMessage({ type: 'gmail:priority' });
      setPriority(result.items);
    } catch {
      setPriority([]);
    }
  }

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

  function openGmail(): void {
    void chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#inbox' });
  }

  async function diagnose(): Promise<void> {
    setDiag(null);
    setDiagError(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      if (tab.url && !tab.url.includes('linkedin.com')) {
        throw new Error('Open a LinkedIn tab first');
      }
      const result = (await chrome.tabs.sendMessage(tab.id, {
        type: DIAGNOSE_MESSAGE,
      })) as LinkedInDiagnostics | undefined;
      if (!result) throw new Error('No response — reload the LinkedIn tab');
      setDiag(result);
    } catch (error) {
      setDiagError(
        `${errorMessage(error)}. If this persists, reload the extension and the LinkedIn tab.`,
      );
    }
  }

  async function testBlur(): Promise<void> {
    setDiag(null);
    setDiagError(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const result = (await chrome.tabs.sendMessage(tab.id, {
        type: TEST_BLUR_MESSAGE,
      })) as TestBlurResult | undefined;
      if (!result) throw new Error('No response — reload the LinkedIn tab');
      if (!result.ok) throw new Error(result.error ?? 'Test blur failed');
      setToast({ kind: 'ok', text: `Test blur applied to ${result.urn}` });
    } catch (error) {
      setDiagError(errorMessage(error));
    }
  }

  async function runProbe(): Promise<void> {
    setDiag(null);
    setDiagError(null);
    setProbe(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const result = (await chrome.tabs.sendMessage(tab.id, {
        type: PROBE_MESSAGE,
      })) as DomProbe | undefined;
      if (!result) throw new Error('No response — reload the LinkedIn tab');
      setProbe(result);
    } catch (error) {
      setDiagError(errorMessage(error));
    }
  }

  async function copyProbe(): Promise<void> {
    if (!probe) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(probe, null, 2));
      setToast({ kind: 'ok', text: 'Probe copied to clipboard' });
    } catch {
      setToast({ kind: 'err', text: 'Copy failed — select the text manually' });
    }
  }

  if (!settings) {
    return <p className="muted small">Loading…</p>;
  }

  const sarvamReady = Boolean(settings.sarvam.apiKey);
  const gmailLabel = gmailStatus?.connected
    ? gmailStatus.email ?? 'Connected'
    : gmailStatus?.clientIdConfigured
      ? 'Not connected'
      : 'Not set up';

  return (
    <div className="stack" style={{ gap: 12 }}>
      <header className="card app-header">
        <Aurora seed="jev-popup-header" hue={228} />
        <div className="app-header__content">
          <div className="brand">
            <SignalMark seed="jev-brand" size={28} bars={5} title="Jev" />
            <div>
              <h1>Jev</h1>
              <p className="brand__tag">Signal over noise</p>
            </div>
          </div>
          <span className="badge">{version ? `v${version}` : 'dev'}</span>
        </div>
      </header>

      <div className="card stack" style={{ gap: 8 }}>
        <StatusRow
          label="AI mode"
          value={mode === 'live' ? 'Jev live' : 'Mock'}
          hue={mode === 'live' ? 152 : 38}
        />
        <StatusRow
          label="Fallback"
          value={sarvamReady ? 'Sarvam ready' : 'Not configured'}
          hue={sarvamReady ? 172 : 220}
        />
        <StatusRow
          label="Gmail"
          value={gmailLabel}
          hue={gmailStatus?.connected ? 152 : 220}
        />
      </div>

      <div className="card card--glow stack" style={vars(glowVars('jev-gmail', 212))}>
        <div className="row">
          <div className="section-head">
            <SignalMark seed="jev-gmail" hue={212} size={20} bars={5} />
            <div>
              <h2>Gmail organizer</h2>
              <p className="small muted">Auto-label and priority view</p>
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Enable Gmail organizer"
              checked={settings.gmail.enabled}
              onChange={(event) => void patch({ gmail: { enabled: event.target.checked } })}
            />
            <span />
          </label>
        </div>

        {priority && priority.length > 0 && (
          <>
            <div className="divider" />
            <div className="row">
              <span className="small muted">Priority inbox</span>
              <button
                className="btn"
                style={{ padding: '2px 8px' }}
                onClick={() => void loadPriority()}
              >
                Refresh
              </button>
            </div>
            <div className="stack" style={{ gap: 2 }}>
              {priority.slice(0, 5).map((item) => {
                const hue = categoryHue(item.category);
                return (
                  <a
                    key={item.id}
                    className="priority-row"
                    style={vars({ '--row-hue': hue })}
                    href={`https://mail.google.com/mail/u/0/#all/${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title={item.reason}
                  >
                    <span className="dot" style={vars({ '--dot-hue': hue })} />
                    <span className="priority-row__subject">{item.subject}</span>
                    <span className="badge" data-hue style={vars({ '--badge-hue': hue })}>
                      {CATEGORY_SHORT[item.category]}
                    </span>
                    <ScoreRing score={item.priority} size={28} hue={hue} />
                  </a>
                );
              })}
            </div>
          </>
        )}

        {priority && priority.length === 0 && (
          <p className="small muted">No priority mail yet — run the organizer from Settings.</p>
        )}

        <div className="row" style={{ gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={openGmail}>
            Open Gmail
          </button>
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={() => void chrome.runtime.openOptionsPage()}
          >
            Organize…
          </button>
        </div>
      </div>

      <div className="card card--glow stack" style={vars(glowVars('jev-linkedin', 194))}>
        <div className="row">
          <div className="section-head">
            <SignalMark seed="jev-linkedin" hue={194} size={20} bars={5} />
            <div>
              <h2>
                LinkedIn de-slop{' '}
                {settings.linkedin.paused && <span className="badge warn">Paused</span>}
              </h2>
              <p className="small muted">Blur low-value posts</p>
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Enable LinkedIn de-slop"
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

        {stats && (
          <div className="stats">
            <div className="stat">
              <div className="stat__value">{stats.scored}</div>
              <div className="stat__label">Scored</div>
            </div>
            <div className="stat">
              <div className="stat__value">{stats.blurred}</div>
              <div className="stat__label">Blurred</div>
            </div>
            <div className="stat">
              <div className="stat__value">{stats.revealed}</div>
              <div className="stat__label">Revealed</div>
            </div>
          </div>
        )}

        <div className="row">
          <span className="small muted">Pause on LinkedIn</span>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Pause on LinkedIn"
              checked={settings.linkedin.paused}
              onChange={(event) => void patch({ linkedin: { paused: event.target.checked } })}
            />
            <span />
          </label>
        </div>

        <details className="stack" style={{ gap: 8 }}>
          <summary className="small muted" style={{ cursor: 'pointer' }}>
            Developer tools
          </summary>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => void diagnose()}>
              Diagnose
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => void testBlur()}>
              Test blur
            </button>
          </div>

          <button className="btn" onClick={() => void runProbe()}>
            DOM probe
          </button>

          {probe && (
            <div className="stack" style={{ gap: 6 }}>
              <textarea
                readOnly
                value={JSON.stringify(probe, null, 2)}
                rows={10}
                style={{
                  width: '100%',
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  lineHeight: 1.4,
                  background: 'var(--bg-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 8,
                  resize: 'vertical',
                }}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button className="btn" onClick={() => void copyProbe()}>
                Copy probe
              </button>
            </div>
          )}

          {diagError && <div className="toast err">{diagError}</div>}

          {diag && (
            <div className="toast ok" style={{ display: 'grid', gap: 2 }}>
              <span>
                Active: {String(diag.active)} · posts found: {diag.roots}
              </span>
              <span>
                Scored: {diag.scored} · blurred: {diag.blurred} · revealed: {diag.revealed}
              </span>
              {diag.sample && (
                <span>
                  Sample: {diag.sample.textLength} chars by {diag.sample.author}
                </span>
              )}
              {diag.lastError && <span>Error: {diag.lastError}</span>}
            </div>
          )}
        </details>
      </div>

      {!settings.consent.dataSharingAccepted && (
        <div className="toast warn">
          Data sharing not accepted. Open settings to review what leaves your browser.
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}

      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn primary"
          style={{ flex: 1 }}
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          Settings
        </button>
        <button className="btn" onClick={() => void clearCache()}>
          Clear cache
        </button>
      </div>
    </div>
  );
}
