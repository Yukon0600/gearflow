import 'reflect-metadata';
import { Body, Controller, Get, Module, Post, Patch, Param, Query, NotFoundException } from '@nestjs/common';
import { resolve } from 'node:path';
import { Store } from './store';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@gearflow/shared';
import { Auth } from './auth';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'gearflow-server' };
  }
}

const store = new Store(process.env.GEARFLOW_DB_PATH || resolve(__dirname, '../data/gearflow.sqlite'));

@Controller()
class InventoryController {
  @Get('workspace') snapshot() { return store.snapshot(); }
  @Get('mobile/stock') mobileStock() { return store.mobileStock(); }
  @Get('mobile/product/:id') mobileProduct(@Param('id') id: string) {
    const product = store.mobileProduct(id);
    if (!product) throw new NotFoundException('商品不存在');
    return product;
  }
  @Get('mobile/summary') mobileSummary() { return store.mobileSummary(); }
  @Get('mobile/movements') mobileMovements(@Query('limit') limit?: string) { return store.mobileMovements(limit ? Number(limit) : 50); }
  @Post('products') product(@Body() body: any) { return store.createProduct(body); }
  @Patch('products/:id') updateProduct(@Param('id') id: string, @Body() body: any) { return store.createProduct(body, id); }
  @Post('orders') order(@Body() body: any) { return store.createOrder(body); }
  @Post('partners') partner(@Body() body: any) { return store.savePartner(body); }
  @Patch('partners/:id') updatePartner(@Param('id') id:string,@Body() body:any) { return store.savePartner(body,id); }
  @Post('drafts') draft(@Body() body:any) { return store.saveDraft(body); }
  @Patch('drafts/:id') updateDraft(@Param('id') id:string,@Body() body:any) { return store.saveDraft(body,id); }
  @Post('drafts/:id/post') postDraft(@Param('id') id:string) { return store.postDraft(id); }
  @Post('stocktakes') stocktake(@Body() body:any) { return store.createStocktake(body); }
  @Post('employees') employee(@Body() body:any) { return store.workforce.saveEmployee(body); }
  @Patch('employees/:id') updateEmployee(@Param('id') id:string,@Body() body:any) { return store.workforce.saveEmployee(body,id); }
  @Post('services') service(@Body() body:any) { return store.workforce.createService(body); }
  @Patch('services/:id/status') serviceStatus(@Param('id') id:string,@Body() body:any) { return store.workforce.transitionService(id,body?.status); }
}

@Module({ controllers: [HealthController, InventoryController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const auth = new Auth(store.db);
  const attempts = new Map<string, { count: number; until: number }>();
  // Register after the JSON parser and before controllers, so every business API is protected.
  app.useBodyParser('json', { limit: '1mb' });
  // 可选 CORS：仅当设置了 GEARFLOW_CORS_ORIGIN 时启用，用于本地 H5 联调。
  // 生产环境不设置该变量，默认不发送任何跨域头。
  const corsOrigin = process.env.GEARFLOW_CORS_ORIGIN || '';
  if (corsOrigin) {
    app.use((req: any, res: any, next: () => void) => {
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') return res.status(204).end();
      next();
    });
  }
  app.use((req: any, res: any, next: () => void) => {
    const path = req.path.replace(/\/$/, '');
    if (!path.startsWith('/api/') || path === '/api/health') return next();
    // 跨站校验只对「带会话 Cookie 的浏览器请求」生效：
    // 小程序与鸿蒙客户端没有浏览器 Cookie，靠 Bearer token 认证，带 Cookie 才存在 CSRF 风险。
    const hasSessionCookie = (req.headers.cookie || '').includes('gearflow_session=');
    if (!['GET', 'HEAD'].includes(req.method) && hasSessionCookie && req.headers['sec-fetch-site'] === 'cross-site') {
      return res.status(403).json({ message: '不允许跨站请求' });
    }
    const cookieToken = (req.headers.cookie || '').split(';').map((s: string) => s.trim()).find((s: string) => s.startsWith('gearflow_session='))?.slice(17) || '';
    // 小程序与鸿蒙没有浏览器 Cookie 机制，额外支持 Authorization: Bearer <token>
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || cookieToken;    const cookie = (value: string, age: number) => res.setHeader('Set-Cookie', `gearflow_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.GEARFLOW_SECURE_COOKIE === '1' ? '; Secure' : ''}`);
    res.setHeader('Cache-Control', 'no-store');
    if (path === '/api/auth/login' && req.method === 'POST') {
      const now = Date.now();
      for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
      const key = req.ip || 'local';
      const attempt = attempts.get(key) || { count: 0, until: now + 60000 };
      if (attempt.count >= 10) return res.status(429).json({ message: '尝试过于频繁，请一分钟后再试' });
      const session = auth.login(req.body?.username, req.body?.password);
      if (!session) { attempt.count++; attempts.set(key, attempt); return res.status(401).json({ message: '账号或密码不正确' }); }
      attempts.delete(key); cookie(session, 28800);
      return res.json({ user: auth.user(session), token: session, expiresIn: 28800 });
    }
    if (path === '/api/auth/logout' && req.method === 'POST') { auth.logout(token); cookie('', 0); return res.json({ ok: true }); }
    const user = auth.user(token);
    if (!user) return res.status(401).json({ message: '请先登录，或登录已过期' });
    if (path === '/api/auth/me' && req.method === 'GET') return res.json({ user });
    next();
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1');
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
