import { createApiApp } from '../src/server/apiApp.ts';

export const config = {
  maxDuration: 60,
};

const app = createApiApp();

export default app;
