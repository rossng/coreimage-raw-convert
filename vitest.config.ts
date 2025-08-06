import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 seconds for RAW conversion tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['src/test.ts'], // Exclude the old test file
    reporter: ['verbose'],
  },
});