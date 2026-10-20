// 后端地址配置
//
// ⚠️ 备案通过后，把 FALLBACK_BASE 改成 'https://timomo.store' 再重新构建一次即可。
// 现在指向公网 IP，是因为备案审核期间域名访问会被阿里云拦截（80 返回 403、443 被重置）。
//
// 需要临时指向别的地址（例如连本地服务做 H5 联调）时，不必改文件，构建前设置环境变量：
//   $env:VITE_API_BASE='http://127.0.0.1:3992'; npm run build:h5
// 用 IP 调试小程序时，开发者工具需关闭域名校验（构建产物已内置 urlCheck: false）。
//
// 正式发布前还要在微信公众平台把 https://timomo.store 加入「request 合法域名」。
const FALLBACK_BASE = 'https://182.92.126.12';

const envBase = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || '';

export const BASE_URL = envBase || FALLBACK_BASE;

export const STORAGE_TOKEN = 'gf_token';
export const STORAGE_PRODUCTS = 'gf_products';
