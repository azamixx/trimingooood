import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages デプロイ時はリポジトリ名がベースパスになる
  // 環境変数 VITE_BASE で上書き可能（ローカル開発時は '/'）
  base: process.env.VITE_BASE || '/',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
})
