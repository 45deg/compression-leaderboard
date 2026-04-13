import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'

// https://vite.dev/config/
export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
  },
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
