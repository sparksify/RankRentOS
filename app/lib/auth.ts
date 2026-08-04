import { createHash } from 'crypto';

// Single-admin auth: session cookie is a hash of the app password + salt.
// Set APP_PASSWORD (and optionally APP_SECRET) in the deployment environment.
const FALLBACK_PASSWORD = 'prosper-batch1-2026';

export function appPassword(): string {
  return process.env.APP_PASSWORD ?? FALLBACK_PASSWORD;
}

export function sessionToken(): string {
  const secret = process.env.APP_SECRET ?? 'rros-static-salt-v1';
  return createHash('sha256').update(`${appPassword()}:${secret}`).digest('hex');
}
