import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import wyw from '@wyw-in-js/vite';

export default defineConfig(() => ({
  plugins: [
    solid(),
    wyw({
      include: ['**/*.{ts,tsx}'],
      babelOptions: {
        presets: ['@babel/preset-typescript'],
      },
    }),
  ],
  server: {
    port: 3000,
  },
}));
