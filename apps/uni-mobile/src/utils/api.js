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
      fail: (err) => reject(new Error(err.errMsg || '网络异常，请检查网络或后端地址')),
    });
  });
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', data: { username, password }, auth: false }),
  me: () => request('/api/auth/me'),
  stock: () => request('/api/mobile/stock'),
};
