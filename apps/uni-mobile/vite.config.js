import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  // 构建期替换的常量，避免在运行时访问 import.meta.env
  // （小程序端没有 import.meta，运行时会报错导致白屏）
  define: {
    __API_BASE__: JSON.stringify(process.env.VITE_API_BASE || ''),
  },
});
