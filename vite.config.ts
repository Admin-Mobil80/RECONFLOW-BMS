import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // `dist` is what the deploy workflow syncs (repo variable BUILD_DIR
    // defaults to it), and what the CloudFront distribution serves.
    outDir: 'dist',
    // Not published: the bucket is public-facing via CloudFront and
    // hashed assets are cached immutable, so maps would be permanent.
    sourcemap: false,
  },
});
