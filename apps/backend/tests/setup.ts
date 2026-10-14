process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/outreachos';
process.env.SESSION_SECRET ??= 'test-session-secret-that-is-long-enough-123';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';
