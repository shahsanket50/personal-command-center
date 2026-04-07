// Gmail service — personal account only (Phase 6)
// Auth: Google OAuth2 via googleapis
// Token stored in google-credentials.json (gitignored)

export function getGmailConfig() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`${key} is not set`);
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    account: process.env.GMAIL_ACCOUNT_PERSONAL,
  };
}

// Install when building Phase 6:
//   npm install googleapis
//
// Scope needed: https://www.googleapis.com/auth/gmail.readonly
