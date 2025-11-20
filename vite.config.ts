import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  root: '.',
  base: '/badminton/',
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Badminton Tactic Board',
        short_name: 'Badminton Board',
        description: 'A professional badminton doubles tactic board with auto-rotation.',
        theme_color: '#111827', // gray-900
        background_color: '#111827',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // [name] 會保留原始檔名
        // [ext] 會保留原始副檔名

        // 1. 設定 JS 入口檔案的命名規則
        entryFileNames: `assets/[name].js`,

        // 2. 設定 JS 程式碼拆分 (code-splitting) 檔案的命名規則
        chunkFileNames: `assets/[name].js`,

        // 3. 設定 CSS、圖片等其他靜態資源的命名規則
        assetFileNames: `assets/[name].[ext]`
      }
    }
  }
})
