import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  // 构建期替换的常量，避免在运行时访问 import.meta.env
  // （小程序端没有 import.meta，运行时会报错导致白屏）
  define: {
    __API_BASE__: JSON.stringify(process.env.VITE_API_BASE || ''),
    // 开发期登录预填，只在本地构建时注入，仓库里不保存任何凭据
    __DEV_USER__: JSON.stringify(process.env.VITE_DEV_USER || ''),
    __DEV_PWD__: JSON.stringify(process.env.VITE_DEV_PWD || ''),
  },
});
