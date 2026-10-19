# B/S 架构与模块边界

客户浏览器（Vue，5173） → HTTP /api → Node.js / NestJS（3000） → SQLite 数据库。

- apps/customer-web：企业客户/门店员工的业务端，商品、采购、销售、流水、导出。
- apps/admin-web：之前的视觉看板原型，5174 单独运行，并非已实现的平台管理后台。
- apps/server：真正的后端服务，无 UI，负责校验与数据库事务。
- apps/mobile：预留扫码盘点端。
- packages/shared：共享常量和后续接口类型。
- infra：后续部署配置。

## 已实现

新商品库存为 0，SKU 唯一，金额以整数分存储。采购和销售支持多行商品，金额由服务器计算。
出库验证可用库存，不允许负库存；同单据的重复商品行拒绝提交。
单据、明细、库存、流水在一个事务中更新。重启保留数据。
首次启动生成 10 个演示商品和期初流水，后续不重置。

## API

- GET /api/health：健康检查。
- GET /api/workspace：商品、单据、流水、分类。
- POST /api/products：创建零库存商品。
- POST /api/orders：采购入库或销售出库。

## 当前边界

SQLite 用于本机可运行体验，尚未接入 PostgreSQL。读取 API 暂时一次返回全部数据。
正式上线需补 PostgreSQL、登录与角色权限、企业隔离、分页、备份和部署。
退货、单据冲销、成本核算尚未实现，资产卡仅按商品采购参考价估算。
开发服务器仅监听本机，当前没有鉴权，不应直接暴露公网。

## 最新业务与交互

商品可在表格末尾编辑，也可从详情抽屉进入编辑。修改库存以外的商品资料，不直接改库存。
新增 PATCH /api/products/:id，检查商品存在、SKU 唯一、金额和预警值合法。
商品列表可切换卡片、按名称/库存/价格排序；手机默认卡片。列表新增客户端分页。
Vben 分页源码与主题引用详见 docs/open-source-ui.md。

## 第一阶段实现状态

已完成：往来单位新增/编辑/搜索与历史交易，采购销售草稿保存/编辑/确认，单据详情，库存盘点与差异流水。
档案名称和类型固定，防止按名称关联的历史交易被错误重命名。
草稿完成确认具有幂等性；盘点在事务内验证账面数量，遇库存变化拒绝写入。
新增表通过 CREATE TABLE IF NOT EXISTS 创建，原商品、单据、库存数据保留。

新增 API：
- POST /api/partners，PATCH /api/partners/:id
- POST /api/drafts，PATCH /api/drafts/:id，POST /api/drafts/:id/post
- POST /api/stocktakes

业务页面：apps/customer-web/src/components/BusinessPanel.vue。
计划与剩余工作见 roadmap.md；登录、角色权限、多仓库、PostgreSQL 迁移仍待实施。
目前往来档案按单位名称及单据类型关联，正式多企业版本须迁移到企业范围内的外键。
