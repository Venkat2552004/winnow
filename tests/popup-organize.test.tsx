import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrganizeTab } from '../entrypoints/popup/OrganizeTab';
import { savePreviewSnapshot } from '../lib/gmail/snapshot';
import type { OrganizeRow } from '../lib/gmail/types';
import type { EmailCategory } from '../lib/winnow/types';
import { DEFAULT_SETTINGS, type Settings } from '../lib/storage';
import { chromeMock } from './setup';

function row(id: string, category: EmailCategory, subject: string): OrganizeRow {
  return {
    message: {
      id,
      threadId: id,
      from: 'sender@example.com',
      subject,
      date: '2026-11-20T10:00:00.000Z',
      snippet: '',
      labelIds: [],
      hasListUnsubscribe: false,
      listUnsubscribe: null,
      listUnsubscribePost: null,
    },
    classification: {
      category,
      priority: 80,
      confidence: 0.9,
      reason: 'test',
      source: 'heuristic',
    },
    labelNames: [],
  };
}

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  gmail: { ...DEFAULT_SETTINGS.gmail, labelPrefix: '' },
};

function renderTab(overrides: Partial<Settings> = {}) {
  return render(
    <OrganizeTab
      settings={{ ...settings, ...overrides }}
      gmailStatus={{ connected: true, email: 'me@example.com', clientIdConfigured: true }}
      onToast={() => undefined}
      onOpenSettings={() => undefined}
    />,
  );
}

describe('OrganizeTab', () => {
  it('groups the saved scan by category with counts', async () => {
    await savePreviewSnapshot(
      [
        row('1', 'security_alert', 'New sign-in'),
        row('2', 'security_alert', 'Password changed'),
        row('3', 'offers', '50% off'),
      ],
      { lookbackDays: 7, maxMessages: 200 },
    );

    const { container } = renderTab();

    await screen.findByText('New sign-in');
    const groups = [...container.querySelectorAll('.organize-group')];
    expect(groups).toHaveLength(2);

    const [security, offers] = groups;
    if (!security || !offers) throw new Error('expected two groups');
    expect(security.querySelector('.organize-group__name')?.textContent).toBe('Security');
    expect(security.querySelector('.organize-group__head .badge')?.textContent).toBe('2');
    expect(offers.querySelector('.organize-group__name')?.textContent).toBe('Offers');
    expect(offers.querySelector('.organize-group__head .badge')?.textContent).toBe('1');
    expect(
      security.querySelector('.organize-group__link')?.getAttribute('href'),
    ).toContain('#search/label%3A%22Security%22');
    expect(screen.getByText('Apply 3 labels')).toBeInTheDocument();
  });

  it('shows the empty state when there is no snapshot', async () => {
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/No scan yet/i)).toBeInTheDocument(),
    );
  });

  it('asks the user to connect Gmail when disconnected', async () => {
    render(
      <OrganizeTab
        settings={settings}
        gmailStatus={{ connected: false, email: null, clientIdConfigured: true }}
        onToast={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );

    expect(
      await screen.findByText(/Connect Gmail to scan and label mail/i),
    ).toBeInTheDocument();
  });

  it('applies the saved rows through the background worker', async () => {
    await savePreviewSnapshot([row('1', 'invoice', 'Invoice #1042')], {
      lookbackDays: 7,
      maxMessages: 200,
    });
    chromeMock.runtime.sendMessage.mockResolvedValueOnce({
      ok: true,
      data: { labeled: 1, skipped: 0, total: 1 },
    });
    const onToast = vi.fn();

    render(
      <OrganizeTab
        settings={settings}
        gmailStatus={{ connected: true, email: 'me@example.com', clientIdConfigured: true }}
        onToast={onToast}
        onOpenSettings={() => undefined}
      />,
    );

    const apply = await screen.findByRole('button', { name: 'Apply 1 label' });
    apply.click();

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith('ok', 'Labeled 1 · skipped 0 · total 1'),
    );
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'gmail:apply',
      rows: [expect.objectContaining({ message: expect.objectContaining({ id: '1' }) })],
    });
  });
});
