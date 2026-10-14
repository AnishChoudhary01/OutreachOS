import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { setupFiles: ['./apps/backend/tests/setup.ts'] } });
