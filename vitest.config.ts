import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest-native tests use describe/it; custom harness tests are run via tsx.
    // Keep include narrow so `vitest list` and `vitest run` only consider vitest-style suites,
    // avoiding "No test suite found" failures for the 7 legacy tsx suites.
    include: ['src/server/logger.test.ts', 'src/server/vitest-compat.test.ts'],
    environment: 'node',
    globals: false,
    exclude: ['node_modules', 'dist', 'e2e/**', 'tests/**'],
    reporters: ['verbose'],
  },
});
