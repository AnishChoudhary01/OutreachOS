import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'), PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1), REDIS_HOST: z.string().default('localhost'), REDIS_PORT: z.coerce.number().int().positive().default(6379), REDIS_PASSWORD: z.string().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5), MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().int().nonnegative().default(2000), MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(100), QUEUE_NAME: z.string().default('outreachos-emails'), RECONCILIATION_BATCH_SIZE: z.coerce.number().int().positive().default(500),
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'), ETHEREAL_PORT: z.coerce.number().int().positive().default(587), ETHEREAL_USER: z.string().optional(), ETHEREAL_PASSWORD: z.string().optional(), ETHEREAL_SECURE: z.coerce.boolean().default(false),
  GOOGLE_CLIENT_ID: z.string().optional(), GOOGLE_CLIENT_SECRET: z.string().optional(), GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:4000/api/auth/google/callback'), SESSION_SECRET: z.string().min(32), FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'), COOKIE_SECURE: z.coerce.boolean().default(false),
  SLACK_CLIENT_ID: z.string().optional(), SLACK_CLIENT_SECRET: z.string().optional(), SLACK_REDIRECT_URI: z.string().url().default('http://localhost:4000/api/auth/slack/callback'), SLACK_NOTIFICATION_CHANNEL: z.string().optional(), TOKEN_ENCRYPTION_KEY: z.string().optional(), ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'), ELASTICSEARCH_USERNAME: z.string().optional(), ELASTICSEARCH_PASSWORD: z.string().optional(), ELASTICSEARCH_INDEX: z.string().default('outreachos-emails'), BULL_BOARD_ADMIN_EMAILS: z.string().default('')
});
export const env = schema.parse(process.env);
