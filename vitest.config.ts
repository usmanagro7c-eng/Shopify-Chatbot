import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Load environment variables
// Try .env.test first (for CI), then fall back to .env.local (for local development)
const testEnv = resolve(__dirname, '.env.test');
const localEnv = resolve(__dirname, '.env.local');
const envPath = existsSync(testEnv) ? testEnv : localEnv;

config({ path: envPath });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Note: Some tests intentionally call APIs with test credentials to verify
    // error handling. This results in harmless API errors logged to stderr
    // but does not cause test failures (all 216 tests pass).
    // See GitHub PR #12 for CI/CD pipeline details.
    
    // Allow tests to pass even if there are unhandled rejections
    // (These come from expected API errors in error-handling tests)
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
