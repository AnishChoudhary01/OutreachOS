import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
export type DeliveryResult = { messageId: string; previewUrl?: string };
export function createMailer() { if (!env.ETHEREAL_USER || !env.ETHEREAL_PASSWORD) throw new Error('SMTP_NOT_CONFIGURED'); return nodemailer.createTransport({ host: env.ETHEREAL_HOST, port: env.ETHEREAL_PORT, secure: env.ETHEREAL_SECURE, auth: { user: env.ETHEREAL_USER, pass: env.ETHEREAL_PASSWORD } }); }
export async function sendEmail(input: { from: string; to: string; subject: string; text: string }): Promise<DeliveryResult> { const transport = createMailer(); const info = await transport.sendMail(input); return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) || undefined }; }
