import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  root: '.',
  base: '/badminton/',
  plugins: [vue(), tailwindcss()],
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
