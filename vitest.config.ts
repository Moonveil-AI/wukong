import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/tsup.config.ts',
        '**/vitest.config.ts',
      ],
    },
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],
    // Ensure proper cleanup after test timeout
    testTimeout: 30000,
    hookTimeout: 10000,
    // Use process pool isolation to ensure processes can exit
    pool: 'forks',
    // Exit immediately after tests complete
    teardownTimeout: 5000,
  },
});
