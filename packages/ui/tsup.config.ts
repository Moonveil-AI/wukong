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
  onSuccess: 'cp src/styles/global.css dist/styles.css',
});
