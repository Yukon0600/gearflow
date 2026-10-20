import { BASE_URL, STORAGE_TOKEN, STORAGE_PRODUCTS } from '../config.js';

export function getToken() {
  return uni.getStorageSync(STORAGE_TOKEN) || '';
}

export function setToken(token) {
  uni.setStorageSync(STORAGE_TOKEN, token);
}

export function clearToken() {
  uni.removeStorageSync(STORAGE_TOKEN);
  uni.removeStorageSync(STORAGE_PRODUCTS);
}

export function request(path, options = {}) {
  const { method = 'GET', data, auth = true } = options;
  const header = { 'Content-Type': 'application/json' };
  if (auth && getToken()) header.Authorization = `Bearer ${getToken()}`;

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + path,
      method,
      data,
      header,
      timeout: 15000,
      success: (res) => {
        if (res.statusCode === 401) {
          clearToken();
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(new Error((res.data && res.data.message) || `请求失败（${res.statusCode}）`));
      },
      fail: (err) => reject(new Error(err.errMsg || '网络异常，请检查后端地址')),
    });
  });
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', data: { username, password }, auth: false }),
  me: () => request('/api/auth/me'),
  summary: () => request('/api/mobile/summary'),
  stock: () => request('/api/mobile/stock'),
  movements: (limit = 50) => request(`/api/mobile/movements?limit=${limit}`),
  createOrder: (payload) => request('/api/orders', { method: 'POST', data: payload }),
};

/** 分转元，保留两位 */
export function yuan(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

/** 千分位 */
export function thousands(value) {
  return String(Math.round(Number(value || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 相对时间：刚刚 / 12 分钟前 / 昨天 14:30 / 10-18 09:12 */
export function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const pad = (n) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (min < 60 * 24) return `今天 ${hm}`;
  if (min < 60 * 48) return `昨天 ${hm}`;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

export const MOVEMENT_LABEL = {
  purchase: '采购入库',
  sale: '销售出库',
  stocktake: '盘点调整',
  opening: '期初建账',
};
