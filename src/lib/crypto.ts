/**
 * Client-side password hashing using SHA-256.
 *
 * WARNING: This is NOT enabled by default. The backend currently expects
 * plaintext passwords (hashed server-side with bcrypt). Enabling client-side
 * hashing requires BACKEND changes to hash the incoming value before bcrypt
 * comparison.
 *
 * To enable, set NEXT_PUBLIC_PASSWORD_HASH_ENABLED=true in .env and keep it
 * aligned with Squid CLIENT_PASSWORD_HASH_ENABLED.
 */

const HASH_ENABLED = process.env.NEXT_PUBLIC_PASSWORD_HASH_ENABLED === 'true';

export function isPasswordHashEnabled(): boolean {
  return HASH_ENABLED;
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, email: string): Promise<string> {
  if (!HASH_ENABLED) return password;
  return sha256(password + email);
}
