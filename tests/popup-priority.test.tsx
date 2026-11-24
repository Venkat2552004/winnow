import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../entrypoints/popup/App';
import { PRIORITY_KEY } from '../lib/gmail/priority';
import type { PriorityEntry } from '../lib/gmail/types';
import { chromeMock } from './setup';

afterEach(cleanup);

function entry(id: string, subject: string, priority = 90): PriorityEntry {
  return {
    id,
    subject,
    from: 'sender@example.com',
    date: '2026-11-20T10:00:00.000Z',
    category: 'security_alert',
    priority,
    reason: 'test',
    at: Date.now(),
  };
}

interface Options {
  priority?: PriorityEntry[];
  refreshPriority?: PriorityEntry[];
}

function mockBackground({ priority = [], refreshPriority = priority }: Options = {}) {
  chromeMock.runtime.sendMessage.mockImplementation(async (request: { type: string }) => {
    switch (request.type) {
      case 'ping':
        return { ok: true, data: { version: '0.1.0', mode: 'mock', provider: 'mock' } };
      case 'gmail:status':
        return {
          ok: true,
          data: { connected: true, email: 'me@example.com', clientIdConfigured: true },
        };
      case 'gmail:priority': {
        const items = (request as { refresh?: boolean }).refresh
          ? refreshPriority
          : priority;
        return { ok: true, data: { items } };
      }
      default:
        return { ok: true, data: null };
    }
  });
}

function priorityCalls(): unknown[] {
  return chromeMock.runtime.sendMessage.mock.calls
    .map(([request]) => request)
    .filter((request) => (request as { type?: string })?.type === 'gmail:priority');
}

describe('popup priority inbox', () => {
  it('renders the priority items on mount', async () => {
    mockBackground({ priority: [entry('1', 'New sign-in')] });
    render(<App />);

    expect(await screen.findByText('New sign-in')).toBeInTheDocument();
  });

  it('keeps Refresh available when the inbox is empty', async () => {
    mockBackground();
    render(<App />);

    const refresh = await screen.findByRole('button', { name: 'Refresh' });
    expect(refresh).toBeInTheDocument();
  });

  it('re-scans mail when Refresh is clicked', async () => {
    mockBackground({
      priority: [],
      refreshPriority: [entry('1', 'Fresh mail')],
    });
    render(<App />);

    const refresh = await screen.findByRole('button', { name: 'Refresh' });
    refresh.click();

    expect(await screen.findByText('Fresh mail')).toBeInTheDocument();
    expect(priorityCalls()).toContainEqual({ type: 'gmail:priority', refresh: true });
  });

  it('reloads when the priority store changes', async () => {
    mockBackground({ priority: [entry('1', 'Old mail')] });
    render(<App />);
    await screen.findByText('Old mail');

    chromeMock.runtime.sendMessage.mockImplementation(async (request: { type: string }) => {
      if (request.type === 'ping') {
        return { ok: true, data: { version: '0.1.0', mode: 'mock', provider: 'mock' } };
      }
      if (request.type === 'gmail:priority') {
        return { ok: true, data: { items: [entry('2', 'Organized mail')] } };
      }
      return { ok: true, data: null };
    });

    await chrome.storage.local.set({ [PRIORITY_KEY]: {} });

    await waitFor(() => expect(screen.getByText('Organized mail')).toBeInTheDocument());
  });

  it('shows an error toast instead of silently emptying the inbox', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(async (request: { type: string }) => {
      if (request.type === 'ping') {
        return { ok: true, data: { version: '0.1.0', mode: 'mock', provider: 'mock' } };
      }
      if (request.type === 'gmail:status') {
        return { ok: true, data: { connected: false, email: null, clientIdConfigured: false } };
      }
      return { ok: false, error: 'No response from the Winnow background worker' };
    });
    render(<App />);

    expect(
      await screen.findByText(/No response from the Winnow background worker/i),
    ).toBeInTheDocument();
  });
});
