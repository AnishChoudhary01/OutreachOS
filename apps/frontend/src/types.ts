export interface User { id: string; name: string; email: string; avatarUrl?: string | null }
export interface Sender { id: string; name: string; email: string }
export interface Email { id: string; recipientEmail: string; subject: string; body?: string; scheduledTime: string; sentTime?: string | null; status: 'scheduled' | 'processing' | 'sent' | 'failed'; lastError?: string | null; sender?: Sender }
export interface Page<T> { items: T[]; page: number; limit: number; total: number }
export interface SlackConnection { id: string; teamId: string; teamName?: string | null; active: boolean }
