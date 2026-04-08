// Microsoft Graph service — office Outlook email + Outlook Calendar (Phase 3 & 6)
// Auth: Azure AD OAuth2 via MSAL (@azure/msal-node)
// Scope: Calendars.Read, offline_access
// Token stored in ms-token.json (gitignored)

import { ConfidentialClientApplication } from '@azure/msal-node';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MS_TOKEN_PATH = path.resolve(__dirname, '../../ms-token.json');
const REDIRECT_URI = 'http://localhost:3001/api/auth/microsoft/callback';
const SCOPES = ['Calendars.Read', 'offline_access'];

export function getMSGraphConfig() {
  const required = ['MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'MS_TENANT_ID'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`${key} is not set`);
  }
  return {
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    tenantId: process.env.MS_TENANT_ID,
    account: process.env.MS_ACCOUNT_OFFICE,
  };
}

function getMsalApp() {
  const { clientId, clientSecret, tenantId } = getMSGraphConfig();
  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });
}

/** Returns the Azure AD auth URL to redirect the user to. */
export async function getMSAuthUrl() {
  const app = getMsalApp();
  return app.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });
}

/** Exchange auth code for tokens and persist to ms-token.json. */
export async function handleMSCallback(code) {
  const app = getMsalApp();
  const result = await app.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });

  const msalCache = app.getTokenCache().serialize();
  await writeFile(
    MS_TOKEN_PATH,
    JSON.stringify({ accessToken: result.accessToken, expiresOn: result.expiresOn, msalCache }, null, 2)
  );

  return result;
}

export async function isMSConnected() {
  try {
    await readFile(MS_TOKEN_PATH, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a valid access token, refreshing silently if needed.
 * Throws if the user has not connected or the token cannot be refreshed.
 */
export async function getMSAccessToken() {
  let cached;
  try {
    const raw = await readFile(MS_TOKEN_PATH, 'utf8');
    cached = JSON.parse(raw);
  } catch {
    throw new Error('Microsoft account not connected');
  }

  // Still valid with >5 min buffer
  if (cached.accessToken && cached.expiresOn) {
    const expiresOn = new Date(cached.expiresOn);
    if (expiresOn.getTime() - Date.now() > 5 * 60 * 1000) {
      return cached.accessToken;
    }
  }

  // Silent refresh using persisted MSAL cache
  if (cached.msalCache) {
    const app = getMsalApp();
    app.getTokenCache().deserialize(cached.msalCache);
    const accounts = await app.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      const result = await app.acquireTokenSilent({
        scopes: ['Calendars.Read'],
        account: accounts[0],
      });
      const msalCache = app.getTokenCache().serialize();
      await writeFile(
        MS_TOKEN_PATH,
        JSON.stringify({ accessToken: result.accessToken, expiresOn: result.expiresOn, msalCache }, null, 2)
      );
      return result.accessToken;
    }
  }

  throw new Error('Microsoft token expired — please reconnect');
}
