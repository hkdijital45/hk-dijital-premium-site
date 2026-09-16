type GoogleOAuthCredential = {
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  token_expires_at?: string | null;
};

// Google access tokens expire routinely and getGoogleToken refreshes them.
// This credential belongs only to Google, never to Meta or TikTok cards.
export function googleTokenNeedsReconnect(credential?: GoogleOAuthCredential | null, now = Date.now()): boolean {
  if (!credential?.access_token_encrypted) return true;
  const expiresAt = credential.token_expires_at ? new Date(credential.token_expires_at).getTime() : 0;
  const accessTokenValid = Number.isFinite(expiresAt) && expiresAt > now + 60_000;
  return !accessTokenValid && !credential.refresh_token_encrypted;
}
