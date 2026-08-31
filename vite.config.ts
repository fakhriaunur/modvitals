import { defineConfig } from 'vite';
import { devvit } from '@devvit/start/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    devvit(),
    // Bundle analysis — emitted on demand via ANALYZE=1 (heavy_dependency_detection).
    // Generates stats.html treemap; does not affect normal builds (0 ms overhead when disabled).
    ...(process.env.ANALYZE === '1'
      ? [
          visualizer({
            filename: 'dist/stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  build: {
    // Enable build caching & chunk analysis for build_performance_tracking
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
  },
});
