import { createAuthClient } from 'better-auth/react';

// /api is served through the same origin in development and production.
export const authClient = createAuthClient();
