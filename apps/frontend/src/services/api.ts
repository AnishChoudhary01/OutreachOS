import axios from 'axios';
import type { Email, Page, Sender, SlackConnection, User } from '../types';
export const apiBase = (import.meta.env.VITE_API_URL as string | undefined || 'http://localhost:4000').replace(/\/$/, '');
export const api = axios.create({ baseURL: `${apiBase}/api`, withCredentials: true });
export async function getMe() { return (await api.get<{ user: User }>('/auth/me')).data.user; }
export async function logout() { await api.post('/auth/logout'); }
export async function listEmails(status: 'scheduled' | 'sent', page = 1, limit = 20) { return (await api.get<Page<Email>>(`/emails/${status}`, { params: { page, limit } })).data; }
export async function searchEmails(q: string, status?: string, page = 1, limit = 20) { return (await api.get<Page<Email>>('/search/emails', { params: { q, status: status || undefined, page, limit } })).data; }
export async function listSenders() { return (await api.get<{ senders: Sender[] }>('/senders')).data.senders; }
export async function scheduleEmail(payload: { senderId: string; recipients: string[]; subject: string; body: string; startTime: string; delayBetweenEmailsMs: number; maxEmailsPerHour: number; idempotencyKey: string }) { return (await api.post('/emails/schedule', payload)).data as { scheduleId: string; emailIds: string[]; scheduledTimes: string[] }; }
export async function slackConnections() { return (await api.get<{ connections: SlackConnection[] }>('/auth/slack/connection')).data.connections; }
export async function disconnectSlack(id: string) { await api.delete(`/auth/slack/${id}`); }
