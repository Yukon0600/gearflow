// 后端地址配置
//
// ⚠️ 备案通过后，把 FALLBACK_BASE 改成 'https://timomo.store' 再重新构建一次即可。
// 现在指向公网 IP，是因为备案审核期间域名访问会被阿里云拦截（80 返回 403、443 被重置）。
//
// __API_BASE__ 是构建期常量（见 vite.config.js），默认空字符串，用于本地 H5 联调：
//   $env:VITE_API_BASE='http://127.0.0.1:3992'; npm run build:h5
// 这里刻意不用 import.meta.env —— 小程序端没有该对象，运行时会直接报错白屏。
const FALLBACK_BASE = 'https://182.92.126.12';

export const BASE_URL = __API_BASE__ || FALLBACK_BASE;

export const STORAGE_TOKEN = 'gf_token';
export const STORAGE_PRODUCTS = 'gf_products';
