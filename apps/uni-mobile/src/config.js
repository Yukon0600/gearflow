// 后端地址配置
//
// ⚠️ 备案通过后，把下面这行改成 'https://timomo.store' 再重新构建一次即可。
// 现在指向公网 IP，是因为备案审核期间域名访问会被阿里云拦截（80 返回 403、443 被重置）。
// 用 IP 调试时，开发者工具需要关闭域名校验（构建产物已内置 urlCheck: false）。
//
// 正式发布前还要在微信公众平台把 https://timomo.store 加入「request 合法域名」。
export const BASE_URL = 'https://182.92.126.12';

export const STORAGE_TOKEN = 'gf_token';
export const STORAGE_PRODUCTS = 'gf_products';
