import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { GmailStatus, OrganizeRow } from '../../lib/gmail/types';
import { readPreviewSnapshot, type PreviewSnapshot } from '../../lib/gmail/snapshot';
import { sendMessage } from '../../lib/messaging';
import type { Settings } from '../../lib/storage';
import { errorMessage } from '../../lib/types';
import { ScoreRing } from '../../lib/ui/ScoreRing';
import { SignalMark } from '../../lib/ui/SignalMark';
import { categoryHue, glowVars } from '../../lib/ui/generative';
import { CATEGORY_LABEL, gmailLabelFor, type EmailCategory } from '../../lib/winnow/types';

type ToastKind = 'ok' | 'err';

interface Props {
  settings: Settings;
  gmailStatus: GmailStatus | null;
  onToast: (kind: ToastKind, text: string) => void;
  onOpenSettings: () => void;
}

const vars = (values: Record<string, string | number>): CSSProperties =>
  values as CSSProperties;

interface CategoryGroup {
  category: EmailCategory;
  rows: OrganizeRow[];
}

function gmailLabelUrl(labelName: string): string {
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(
    `label:"${labelName}"`,
  )}`;
}

function relativeTime(at: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  return `${minutes} min ago`;
}

export function OrganizeTab({ settings, gmailStatus, onToast, onOpenSettings }: Props) {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readPreviewSnapshot()
      .then((saved) => {
        if (!cancelled) setSnapshot(saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo<CategoryGroup[]>(() => {
    if (!snapshot) return [];
    const byCategory = new Map<EmailCategory, OrganizeRow[]>();
    for (const row of snapshot.rows) {
      const list = byCategory.get(row.classification.category) ?? [];
      list.push(row);
      byCategory.set(row.classification.category, list);
    }
    return [...byCategory.entries()]
      .map(([category, rows]) => ({
        category,
        rows: [...rows].sort(
          (a, b) => b.classification.priority - a.classification.priority,
        ),
      }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [snapshot]);

  const priorityCount = snapshot
    ? snapshot.rows.filter((row) => row.classification.priority >= settings.gmail.priorityThreshold)
        .length
    : 0;

  async function scan(): Promise<void> {
    setScanning(true);
    setError(null);
    try {
      const result = await sendMessage({ type: 'gmail:preview' });
      setSnapshot({
        rows: result.rows,
        at: Date.now(),
        scope: {
          lookbackDays: settings.gmail.lookbackDays,
          maxMessages: settings.gmail.maxMessages,
        },
      });
      onToast(
        'ok',
        result.rows.length > 0
          ? `Classified ${result.rows.length} messages`
          : 'No mail in the lookback window',
      );
    } catch (cause) {
      setError(errorMessage(cause));
      onToast('err', errorMessage(cause));
    } finally {
      setScanning(false);
    }
  }

  async function apply(): Promise<void> {
    if (!snapshot) return;
    setApplying(true);
    setError(null);
    try {
      const result = await sendMessage({ type: 'gmail:apply', rows: snapshot.rows });
      onToast(
        'ok',
        `Labeled ${result.labeled} · skipped ${result.skipped} · total ${result.total}`,
      );
    } catch (cause) {
      setError(errorMessage(cause));
      onToast('err', errorMessage(cause));
    } finally {
      setApplying(false);
    }
  }

  const scope = snapshot?.scope ?? {
    lookbackDays: settings.gmail.lookbackDays,
    maxMessages: settings.gmail.maxMessages,
  };
  const busy = scanning || applying;

  return (
    <div className="card card--glow stack" style={vars(glowVars('winnow-gmail', 212))}>
      <div className="row">
        <div className="section-head">
          <SignalMark seed="winnow-gmail" hue={212} size={20} bars={5} />
          <div>
            <h2>Organize mail</h2>
            <p className="small muted">Group recent mail by Winnow label</p>
          </div>
        </div>
        {snapshot && <span className="badge">{snapshot.rows.length}</span>}
      </div>

      <div className="row">
        <span className="small muted">
          Last {scope.lookbackDays} days · up to {scope.maxMessages} messages
        </span>
        <button className="tab-link" type="button" onClick={onOpenSettings}>
          Change
        </button>
      </div>

      {gmailStatus && !gmailStatus.connected && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small muted">
            {gmailStatus.clientIdConfigured
              ? 'Connect Gmail to scan and label mail from here.'
              : 'Add a Gmail OAuth client ID in Settings, then connect.'}
          </p>
          <button className="btn primary" onClick={onOpenSettings}>
            Open Gmail settings
          </button>
        </div>
      )}

      {gmailStatus?.connected && !settings.gmail.enabled && (
        <p className="small muted">
          The Gmail organizer is off. Turn it on in Settings to scan mail.
        </p>
      )}

      {error && <div className="toast err">{error}</div>}

      {loading && <p className="small muted">Loading last scan…</p>}

      {!loading && !snapshot && gmailStatus?.connected && settings.gmail.enabled && (
        <p className="small muted">
          No scan yet. Scan to classify your recent mail, then review each label group before
          applying.
        </p>
      )}

      {snapshot && (
        <>
          <div className="divider" />
          <div className="row">
            <span className="small muted">
              {snapshot.rows.length} messages · {priorityCount} priority ·{' '}
              {relativeTime(snapshot.at)}
            </span>
            <button
              className="btn"
              style={{ padding: '2px 8px' }}
              onClick={() => void scan()}
              disabled={busy || !settings.gmail.enabled || !gmailStatus?.connected}
            >
              Rescan
            </button>
          </div>
        </>
      )}

      {groups.map((group) => {
        const hue = categoryHue(group.category);
        const labeled =
          settings.gmail.autoLabel &&
          settings.gmail.enabledCategories.includes(group.category);
        const labelName = labeled
          ? gmailLabelFor(group.category, settings.gmail.labelPrefix)
          : null;
        return (
          <div key={group.category} className="organize-group" style={vars({ '--row-hue': hue })}>
            <div className="organize-group__head">
              <span className="dot" style={vars({ '--dot-hue': hue })} />
              <span className="organize-group__name">{CATEGORY_LABEL[group.category]}</span>
              <span className="badge" data-hue style={vars({ '--badge-hue': hue })}>
                {group.rows.length}
              </span>
              {labelName && <span className="organize-group__label">{labelName}</span>}
              {labelName && (
                <a
                  className="organize-group__link"
                  href={gmailLabelUrl(labelName)}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open ${labelName} in Gmail`}
                >
                  Open
                </a>
              )}
            </div>
            {group.rows.slice(0, 2).map((row) => (
              <a
                key={row.message.id}
                className="priority-row"
                style={vars({ '--row-hue': hue })}
                href={`https://mail.google.com/mail/u/0/#all/${row.message.id}`}
                target="_blank"
                rel="noreferrer"
                title={row.classification.reason}
              >
                <span className="priority-row__subject">{row.message.subject}</span>
                <ScoreRing score={row.classification.priority} size={24} hue={hue} />
              </a>
            ))}
            {labelName && group.rows.length > 2 && (
              <a
                className="small muted organize-group__more"
                href={gmailLabelUrl(labelName)}
                target="_blank"
                rel="noreferrer"
              >
                +{group.rows.length - 2} more
              </a>
            )}
          </div>
        );
      })}

      {gmailStatus?.connected && (
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={() => void scan()}
            disabled={busy || !settings.gmail.enabled}
          >
            {scanning ? 'Scanning…' : 'Scan inbox'}
          </button>
          <button
            className="btn primary"
            style={{ flex: 1 }}
            onClick={() => void apply()}
            disabled={busy || !snapshot || !settings.gmail.enabled}
          >
            {applying
              ? 'Applying…'
              : snapshot
                ? `Apply ${snapshot.rows.length} label${snapshot.rows.length === 1 ? '' : 's'}`
                : 'Apply labels'}
          </button>
        </div>
      )}

      <p className="small muted">
        Adds labels only — never archives or deletes. A scan keeps running if you close the popup.
      </p>
    </div>
  );
}
