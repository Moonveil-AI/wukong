import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/styles/global.css'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['@wukong/agent', 'react', 'react-dom'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  // Copy CSS to output
  publicDir: false,
  onSuccess: () => {
    const distDir = join(__dirname, 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    copyFileSync(join(__dirname, 'src', 'styles', 'global.css'), join(distDir, 'styles.css'));
  },
});
