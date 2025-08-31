/**
 * MSW Server Setup for Node.js (tests)
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// Enable request interception
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers between tests
afterEach(() => server.resetHandlers());

// Clean up
afterAll(() => server.close());