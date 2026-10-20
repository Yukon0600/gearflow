import { http } from '@kit.NetworkKit';

// 后端地址：备案通过后使用域名；调试期若域名被拦截，改成 https://182.92.126.12
export const BASE_URL: string = 'https://timomo.store';

export interface UserInfo {
  username: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: UserInfo;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  stock: number;
  threshold: number;
  price: number;
  low: boolean;
}

export interface StockResponse {
  updatedAt: string;
  total: number;
  lowCount: number;
  products: Product[];
}

interface ErrorBody {
  message?: string;
}

export class Api {
  private static token: string = '';

  static setToken(value: string): void {
    Api.token = value;
  }

  static async login(username: string, password: string): Promise<LoginResponse> {
    const body: string = JSON.stringify({ username: username, password: password });
    const text: string = await Api.send('/api/auth/login', http.RequestMethod.POST, body);
    const res = JSON.parse(text) as LoginResponse;
    Api.token = res.token;
    return res;
  }

  static async stock(): Promise<StockResponse> {
    const text: string = await Api.send('/api/mobile/stock', http.RequestMethod.GET, '');
    return JSON.parse(text) as StockResponse;
  }

  private static async send(path: string, method: http.RequestMethod, body: string): Promise<string> {
    const request = http.createHttp();
    const header: Record<string, string> = { 'Content-Type': 'application/json' };
    if (Api.token.length > 0) {
      header['Authorization'] = 'Bearer ' + Api.token;
    }
    try {
      const options: http.HttpRequestOptions = {
        method: method,
        header: header,
        extraData: body,
        connectTimeout: 15000,
        readTimeout: 15000
      };
      const response = await request.request(BASE_URL + path, options);
      const text: string = response.result as string;
      if (response.responseCode >= 400) {
        throw new Error(Api.messageOf(text, response.responseCode));
      }
      return text;
    } finally {
      request.destroy();
    }
  }

  private static messageOf(text: string, code: number): string {
    try {
      const body = JSON.parse(text) as ErrorBody;
      if (body.message !== undefined && body.message.length > 0) {
        return body.message;
      }
    } catch (e) {
      // 非 JSON 响应，落到下面的通用提示
    }
    return '请求失败（' + code.toString() + '）';
  }
}
