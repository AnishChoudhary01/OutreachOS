import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
const key = () => createHash('sha256').update(env.TOKEN_ENCRYPTION_KEY || env.SESSION_SECRET).digest();
export function encryptSecret(value: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`; }
export function decryptSecret(value: string) { const [iv, tag, data] = value.split('.'); const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8'); }
export function hashToken(value: string) { return createHash('sha256').update(value).digest('hex'); }
