import { useEffect, useState, type CSSProperties } from 'react';
import type {
  CleanupMode,
  CleanupPreview,
  GmailMessageMeta,
  GmailStatus,
  OrganizeRow,
  UnsubscribeSender,
} from '../../lib/gmail/types';
import { CATEGORY_LABEL } from '../../lib/jev/types';
import { sendMessage } from '../../lib/messaging';
import { getSettings, updateSettings, type Settings } from '../../lib/storage';
import { errorMessage } from '../../lib/types';
import { Aurora } from '../../lib/ui/Aurora';
import { ScoreRing } from '../../lib/ui/ScoreRing';
import { SignalAvatar } from '../../lib/ui/SignalAvatar';
import { SignalMark } from '../../lib/ui/SignalMark';
import { categoryHue, glowVars } from '../../lib/ui/generative';

type Toast = { kind: 'ok' | 'err'; text: string };

const vars = (values: Record<string, string | number>): CSSProperties =>
  values as CSSProperties;

function SectionHead({
  seed,
  hue,
  title,
  subtitle,
}: {
  seed: string;
  hue: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="section-head">
      <SignalMark seed={seed} hue={hue} size={22} bars={5} />
      <div>
        <h2>{title}</h2>
        <p className="muted small">{subtitle}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [testing, setTesting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [recent, setRecent] = useState<GmailMessageMeta[] | null>(null);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<OrganizeRow[] | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [senders, setSenders] = useState<UnsubscribeSender[] | null>(null);
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set());
  const [unsubBusy, setUnsubBusy] = useState(false);
  const [cleanup, setCleanup] = useState<CleanupPreview | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);

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
      const provider =
        ping.provider === 'roar' ? 'Roar AI' : ping.provider === 'jev' ? 'Jev API' : 'mock';
      setToast({
        kind: 'ok',
        text: `Background worker OK · v${ping.version} · ${provider} · ${ping.mode} mode`,
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
    setGmailError(null);
    try {
      // Persist the client ID before the background reads it.
      const next = await updateSettings(draft);
      setDraft(next);
      setSaved(next);
      const result = await sendMessage({ type: 'gmail:connect' });
      setGmailStatus({ connected: true, email: result.email, clientIdConfigured: true });
      setToast({ kind: 'ok', text: `Connected ${result.email ?? 'Gmail'}` });
    } catch (error) {
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setGmailBusy(false);
    }
  }

  async function disconnectGmail(): Promise<void> {
    setGmailBusy(true);
    setGmailError(null);
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
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setGmailBusy(false);
    }
  }

  async function loadRecent(): Promise<void> {
    setGmailBusy(true);
    setGmailError(null);
    try {
      const result = await sendMessage({ type: 'gmail:recent', limit: 10 });
      setRecent(result.messages);
      setToast({
        kind: 'ok',
        text: result.messages.length > 0 ? `Loaded ${result.messages.length} messages` : 'No messages in the lookback window',
      });
    } catch (error) {
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setGmailBusy(false);
    }
  }

  async function previewMail(): Promise<void> {
    setOrganizing(true);
    setGmailError(null);
    try {
      const result = await sendMessage({ type: 'gmail:preview' });
      setPreviewRows(result.rows);
      setToast({ kind: 'ok', text: `Classified ${result.rows.length} messages` });
    } catch (error) {
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setOrganizing(false);
    }
  }

  async function applyLabels(): Promise<void> {
    if (!previewRows) return;
    setOrganizing(true);
    setGmailError(null);
    try {
      const result = await sendMessage({ type: 'gmail:apply', rows: previewRows });
      setToast({
        kind: 'ok',
        text: `Labeled ${result.labeled} · skipped ${result.skipped} · total ${result.total}`,
      });
    } catch (error) {
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setOrganizing(false);
    }
  }

  async function resetOrganizer(): Promise<void> {
    try {
      await sendMessage({ type: 'gmail:reset' });
      setPreviewRows(null);
      setToast({ kind: 'ok', text: 'Label memory cleared' });
    } catch (error) {
      setToast({ kind: 'err', text: errorMessage(error) });
    }
  }

  async function scanSenders(): Promise<void> {
    setUnsubBusy(true);
    setGmailError(null);
    try {
      const result = await sendMessage({ type: 'gmail:unsubscribe:scan' });
      setSenders(result.senders);
      setSelectedSenders(new Set(result.senders.map((sender) => sender.email)));
      setToast({
        kind: 'ok',
        text:
          result.senders.length > 0
            ? `Found ${result.senders.length} senders with unsubscribe links`
            : 'No unsubscribe links found in the lookback window',
      });
    } catch (error) {
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setUnsubBusy(false);
    }
  }

  function toggleSender(email: string): void {
    setSelectedSenders((previous) => {
      const next = new Set(previous);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function unsubscribeSelected(): Promise<void> {
    if (!senders || !draft) return;
    const chosen = senders.filter((sender) => selectedSenders.has(sender.email));
    if (chosen.length === 0) {
      setToast({ kind: 'err', text: 'Select at least one sender' });
      return;
    }

    setUnsubBusy(true);
    setGmailError(null);
    try {
      let posted = 0;
      let opened = 0;
      let archived = 0;
      for (const sender of chosen) {
        const result = await sendMessage({
          type: 'gmail:unsubscribe:run',
          sender,
          archive: draft.gmail.unsubscribeArchive,
        });
        if (result.result === 'posted') posted += 1;
        else if (result.result === 'opened' || result.result === 'mailto') opened += 1;
        archived += result.archived;
      }

      setToast({
        kind: 'ok',
        text: `Unsubscribed ${chosen.length} · ${posted} one-click · ${opened} opened · ${archived} archived`,
      });
      setSenders((previous) =>
        previous ? previous.filter((sender) => !selectedSenders.has(sender.email)) : previous,
      );
      setSelectedSenders(new Set());
    } catch (error) {
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setUnsubBusy(false);
    }
  }

  async function previewCleanupMail(): Promise<void> {
    setCleanupBusy(true);
    setGmailError(null);
    try {
      const result = await sendMessage({ type: 'gmail:cleanup:preview' });
      setCleanup(result);
      setToast({
        kind: 'ok',
        text:
          result.total > 0
            ? `${result.total} messages older than ${result.olderThanDays} days`
            : 'Nothing to clean up',
      });
    } catch (error) {
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setCleanupBusy(false);
    }
  }

  async function runCleanup(mode: CleanupMode): Promise<void> {
    if (!cleanup || cleanup.candidates.length === 0) return;
    if (
      mode === 'trash' &&
      !window.confirm(`Move ${cleanup.candidates.length} messages to Trash?`)
    ) {
      return;
    }

    setCleanupBusy(true);
    setGmailError(null);
    try {
      const result = await sendMessage({
        type: 'gmail:cleanup:apply',
        ids: cleanup.candidates.map((candidate) => candidate.id),
        mode,
      });
      setCleanup(null);
      setToast({
        kind: 'ok',
        text: `${mode === 'trash' ? 'Trashed' : 'Archived'} ${result.affected} messages`,
      });
    } catch (error) {
      setGmailError(errorMessage(error));
      setToast({ kind: 'err', text: errorMessage(error) });
    } finally {
      setCleanupBusy(false);
    }
  }

  if (!draft) return <p className="muted">Loading…</p>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <header className="card app-header">
        <Aurora seed="jev-options-header" hue={228} />
        <div className="app-header__content">
          <div className="brand">
            <SignalMark seed="jev-brand" size={30} bars={5} title="Jev" />
            <div>
              <h1>Jev settings</h1>
              <p className="brand__tag">Keys stay in this browser</p>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => void testConnection()} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button className="btn primary" onClick={() => void save()} disabled={!dirty}>
              Save
            </button>
          </div>
        </div>
      </header>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}

      {!draft.consent.dataSharingAccepted && (
        <section className="card section onboarding">
          <Aurora seed="jev-onboarding" hue={252} />
          <div className="onboarding__content">
            <div>
              <h2>Welcome to Jev</h2>
              <p className="muted small">
                Two tools in one extension: a Gmail organizer and a LinkedIn feed filter.
                Everything runs locally except the classification calls described below.
              </p>
            </div>
            <ul className="checklist">
              <li>
                <strong>Gmail</strong> — reads sender, subject, and snippet; applies Jev/* labels;
                archives or trashes only when you click.
              </li>
              <li>
                <strong>LinkedIn</strong> — reads visible post text and blurs low-value posts
                locally.
              </li>
              <li>
                <strong>AI</strong> — email metadata and post text go to the Roar AI gateway, and
                to Sarvam when the fallback is used. Full email bodies never leave the browser.
              </li>
            </ul>
            <label className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.consent.dataSharingAccepted}
                onChange={(event) => setConsent({ dataSharingAccepted: event.target.checked })}
              />
              <span className="small">I understand and accept this data sharing.</span>
            </label>
            <div className="row">
              <button className="btn primary" onClick={() => void save()} disabled={!dirty}>
                Save &amp; continue
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="card section">
        <SectionHead
          seed="jev-api"
          hue={230}
          title="AI provider"
          subtitle="OpenAI-compatible gateway. Mock mode uses deterministic local rules."
        />
        <div className="row">
          <div>
            <h2>Use Roar AI gateway</h2>
            <p className="muted small">
              Read <code>ROAR_API_KEY</code> from <code>.env</code>. Turn off to use a custom
              provider.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Use Roar AI gateway"
              checked={draft.jev.useRoar}
              onChange={(event) => setJev({ useRoar: event.target.checked })}
            />
            <span />
          </label>
        </div>
        <div className="field">
          <label htmlFor="jev-base">Base URL</label>
          <input
            id="jev-base"
            placeholder="https://api.roar-ai.com/v1"
            value={draft.jev.baseUrl}
            disabled={draft.jev.useRoar}
            onChange={(event) => setJev({ baseUrl: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="jev-key">API key</label>
          <input
            id="jev-key"
            type="password"
            placeholder="roar_…"
            value={draft.jev.apiKey}
            disabled={draft.jev.useRoar}
            onChange={(event) => setJev({ apiKey: event.target.value })}
          />
        </div>
        <p className="muted small">
          Roar AI uses the <strong>jev</strong> evaluation model through the official OpenAI SDK.{' '}
          {draft.jev.useRoar ? (
            <>
              Using <code>ROAR_API_KEY</code> from <code>.env</code>.
            </>
          ) : (
            <>
              Add a <code>ROAR_API_KEY</code> to <code>.env</code> to use the gateway, or fill in
              the fields above for a custom provider.
            </>
          )}
        </p>
        <div className="row">
          <div>
            <h2>Mock mode</h2>
            <p className="muted small">Use local heuristics instead of calling the API.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Mock mode"
              checked={draft.jev.mock}
              onChange={(event) => setJev({ mock: event.target.checked })}
            />
            <span />
          </label>
        </div>
      </section>

      <section className="card section">
        <SectionHead
          seed="jev-sarvam"
          hue={268}
          title="Sarvam fallback"
          subtitle="Used only when Jev is unavailable or returns low confidence."
        />
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

      <section className="card card--glow section" style={vars(glowVars('jev-gmail', 212))}>
        <div className="row">
          <SectionHead
            seed="jev-gmail"
            hue={212}
            title="Gmail organizer"
            subtitle="Auto-label recent mail and build a priority view."
          />
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Enable Gmail organizer"
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

        {gmailError && <div className="toast err">{gmailError}</div>}

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

        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn"
            onClick={() => void previewMail()}
            disabled={organizing || !gmailStatus?.connected}
          >
            {organizing ? 'Working…' : 'Preview classification'}
          </button>
          <button
            className="btn primary"
            onClick={() => void applyLabels()}
            disabled={organizing || !previewRows}
          >
            Apply labels
          </button>
        </div>

        {previewRows && (
          <div className="stack" style={{ gap: 6 }}>
            <p className="small muted">
              {previewRows.length} messages ·{' '}
              {
                previewRows.filter(
                  (row) => row.classification.priority >= draft.gmail.priorityThreshold,
                ).length
              }{' '}
              priority
            </p>
            {previewRows.slice(0, 50).map((row) => {
              const hue = categoryHue(row.classification.category);
              return (
                <div
                  key={row.message.id}
                  className="priority-row"
                  style={vars({ '--row-hue': hue })}
                  title={`${row.classification.reason}\n${row.labelNames.join(', ')}`}
                >
                  <span className="dot" style={vars({ '--dot-hue': hue })} />
                  <span className="priority-row__subject">{row.message.subject}</span>
                  <span className="badge" data-hue style={vars({ '--badge-hue': hue })}>
                    {CATEGORY_LABEL[row.classification.category]}
                  </span>
                  <ScoreRing score={row.classification.priority} size={26} hue={hue} />
                </div>
              );
            })}
            {previewRows.length > 50 && (
              <p className="small muted">Showing top 50 of {previewRows.length}</p>
            )}
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
              aria-label="Auto-label mail"
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

      <section className="card card--glow section" style={vars(glowVars('jev-unsubscribe', 172))}>
        <SectionHead
          seed="jev-unsubscribe"
          hue={172}
          title="Unsubscribe & cleanup"
          subtitle="One-click requests are sent directly; other links open in a background tab."
        />

        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn"
            onClick={() => void scanSenders()}
            disabled={unsubBusy || !gmailStatus?.connected}
          >
            {unsubBusy ? 'Working…' : 'Scan senders'}
          </button>
          <button
            className="btn primary"
            onClick={() => void unsubscribeSelected()}
            disabled={unsubBusy || selectedSenders.size === 0}
          >
            Unsubscribe selected ({selectedSenders.size})
          </button>
        </div>

        <div className="row">
          <div>
            <h2>Archive after unsubscribe</h2>
            <p className="muted small">Remove the sender&apos;s scanned messages from the inbox.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Archive after unsubscribe"
              checked={draft.gmail.unsubscribeArchive}
              onChange={(event) => setGmail({ unsubscribeArchive: event.target.checked })}
            />
            <span />
          </label>
        </div>

        {senders && senders.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            {senders.map((sender) => {
              const hue = sender.oneClick ? 152 : sender.https ? 194 : 38;
              return (
                <label
                  key={sender.email}
                  className="priority-row"
                  style={{ ...vars({ '--row-hue': hue }), cursor: 'pointer' }}
                  title={sender.sampleSubject}
                >
                  <input
                    type="checkbox"
                    checked={selectedSenders.has(sender.email)}
                    onChange={() => toggleSender(sender.email)}
                  />
                  <SignalAvatar seed={sender.email} label={sender.name} size={22} hue={hue} />
                  <span className="priority-row__subject">{sender.name}</span>
                  <span className="badge" data-hue style={vars({ '--badge-hue': hue })}>
                    {sender.oneClick ? 'one-click' : sender.https ? 'link' : 'mailto'}
                  </span>
                  <span className="small muted" style={{ width: 28, textAlign: 'right' }}>
                    {sender.count}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {senders && senders.length === 0 && (
          <p className="small muted">No senders with unsubscribe links in the lookback window.</p>
        )}

        <div className="divider" />

        <SectionHead
          seed="jev-cleanup"
          hue={38}
          title="Bulk cleanup"
          subtitle="Aged promotions, newsletters, and notifications. Starred and important mail is never touched."
        />

        <div className="field">
          <label htmlFor="gmail-cleanup-days">Cleanup age (days)</label>
          <input
            id="gmail-cleanup-days"
            type="number"
            min={1}
            max={365}
            value={draft.gmail.cleanupOlderThanDays}
            onChange={(event) => setGmail({ cleanupOlderThanDays: Number(event.target.value) })}
          />
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn"
            onClick={() => void previewCleanupMail()}
            disabled={cleanupBusy || !gmailStatus?.connected}
          >
            {cleanupBusy ? 'Working…' : 'Preview cleanup'}
          </button>
          <button
            className="btn"
            onClick={() => void runCleanup('archive')}
            disabled={cleanupBusy || !cleanup || cleanup.candidates.length === 0}
          >
            Archive
          </button>
          <button
            className="btn danger"
            onClick={() => void runCleanup('trash')}
            disabled={cleanupBusy || !cleanup || cleanup.candidates.length === 0}
          >
            Trash
          </button>
        </div>

        {cleanup && (
          <div className="stack" style={{ gap: 6 }}>
            <p className="small muted">
              {cleanup.total} candidates older than {cleanup.olderThanDays} days
            </p>
            {cleanup.candidates.slice(0, 30).map((candidate) => {
              const hue = categoryHue(candidate.category);
              return (
                <div
                  key={candidate.id}
                  className="priority-row"
                  style={vars({ '--row-hue': hue })}
                  title={candidate.from}
                >
                  <SignalAvatar seed={candidate.from} label={candidate.from} size={22} hue={hue} />
                  <span className="priority-row__subject">{candidate.subject}</span>
                  <span className="badge" data-hue style={vars({ '--badge-hue': hue })}>
                    {CATEGORY_LABEL[candidate.category]}
                  </span>
                  <ScoreRing score={candidate.priority} size={24} hue={hue} />
                </div>
              );
            })}
            {cleanup.total > 30 && (
              <p className="small muted">Showing 30 of {cleanup.total}</p>
            )}
          </div>
        )}
      </section>

      <section className="card card--glow section" style={vars(glowVars('jev-linkedin', 194))}>
        <div className="row">
          <SectionHead
            seed="jev-linkedin"
            hue={194}
            title="LinkedIn de-slop"
            subtitle="Blur posts that score below the threshold."
          />
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Enable LinkedIn de-slop"
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
              aria-label="Pause on LinkedIn"
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
              aria-label="Debug overlay"
              checked={draft.linkedin.debug}
              onChange={(event) => setLinkedin({ debug: event.target.checked })}
            />
            <span />
          </label>
        </div>
      </section>

      <section className="card section">
        <SectionHead
          seed="jev-privacy"
          hue={268}
          title="Privacy"
          subtitle="Metadata and post text go to Jev, and to Sarvam when the fallback is used. Full email bodies never leave the browser."
        />
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
        <div className="row" style={{ gap: 8 }}>
          <button className="btn danger" onClick={() => void clearCache()}>
            Clear cached scores
          </button>
          <button className="btn danger" onClick={() => void resetOrganizer()}>
            Reset label memory
          </button>
        </div>
        <button className="btn primary" onClick={() => void save()} disabled={!dirty}>
          Save settings
        </button>
      </footer>
    </div>
  );
}
