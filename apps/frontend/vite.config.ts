import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: 'apps/frontend', plugins: [react()], server: { port: 5173 } });
