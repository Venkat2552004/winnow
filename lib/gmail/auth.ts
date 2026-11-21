/**
 * Gmail OAuth via chrome.identity.launchWebAuthFlow (implicit flow).
 *
 * Only gmail.modify is requested; the account email comes from users.getProfile,
 * so no extra userinfo scope is needed.
 */

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

const TOKEN_KEY = 'jev.gmail.token.v1';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
  email: string | null;
}

async function readToken(): Promise<StoredToken | null> {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  return (stored[TOKEN_KEY] as StoredToken | undefined) ?? null;
}

async function writeToken(token: StoredToken): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(TOKEN_KEY);
}

export function buildAuthUrl(clientId: string, interactive: boolean): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: SCOPES.join(' '),
    include_granted_scopes: 'true',
    prompt: interactive ? 'consent' : 'none',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function fetchEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { emailAddress?: string };
    return json.emailAddress ?? null;
  } catch {
    return null;
  }
}

async function launch(clientId: string, interactive: boolean): Promise<StoredToken> {
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: buildAuthUrl(clientId, interactive),
    interactive,
  });
  if (!responseUrl) throw new Error('Google authorization was cancelled');

  const fragment = new URLSearchParams(new URL(responseUrl).hash.replace(/^#/, ''));
  const error = fragment.get('error');
  if (error) throw new Error(`Google authorization failed: ${error}`);

  const accessToken = fragment.get('access_token');
  if (!accessToken) throw new Error('Google did not return an access token');

  const expiresIn = Number(fragment.get('expires_in') ?? '3600');
  return {
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
    email: null,
  };
}

/**
 * Returns a valid access token, silently refreshing when possible. When
 * `interactive` is false and no session can be recovered, throws so the UI can
 * ask the user to reconnect.
 */
export async function getAccessToken(clientId: string, interactive: boolean): Promise<string> {
  const stored = await readToken();
  if (stored && stored.expiresAt > Date.now() + 30_000) return stored.accessToken;

  try {
    const fresh = await launch(clientId, false);
    fresh.email = stored?.email ?? (await fetchEmail(fresh.accessToken));
    await writeToken(fresh);
    return fresh.accessToken;
  } catch {
    if (!interactive) {
      throw new Error('Gmail session expired — reconnect Gmail in settings');
    }
    const fresh = await launch(clientId, true);
    fresh.email = await fetchEmail(fresh.accessToken);
    await writeToken(fresh);
    return fresh.accessToken;
  }
}

export async function connectGmail(clientId: string): Promise<string | null> {
  const token = await launch(clientId, true);
  token.email = await fetchEmail(token.accessToken);
  await writeToken(token);
  return token.email;
}

export async function getConnectedEmail(): Promise<string | null> {
  const stored = await readToken();
  return stored?.email ?? null;
}

export async function disconnectGmail(): Promise<void> {
  const stored = await readToken();
  if (stored) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(stored.accessToken)}`,
        { method: 'POST' },
      );
    } catch {
      // Revocation is best effort; clearing the token is what matters.
    }
  }
  await clearToken();
}
