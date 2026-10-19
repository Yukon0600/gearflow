# 开源 UI 引入记录

本地完整克隆：references/soybean-admin-element-plus（独立 Git 仓库，不参与 npm 工作区构建）。

- 上游：https://github.com/soybeanjs/soybean-admin-element-plus
- 固定提交：7613bd206cd42001b40e3eafceeb895dcbc277a8
- 许可证：MIT，Copyright (c) 2021 Soybean。
- 官方演示：https://elp.soybeanjs.cn/

## 已引入的真实代码

复制上游 packages/materials/src/libs/admin-layout 的 index.vue、shared.ts、index.module.css，及其依赖 types/index.ts，放在 apps/customer-web/src/vendor/soybean/。
上游 LICENSE 一并保留。布局源文件保持原样。

客户业务端 App.vue 实际使用此 AdminLayout，提供侧栏、顶部和页签插槽，并绑定折叠状态与移动端状态。
本项目通过 style.css 中的局部工具类兼容上游 UnoCSS 类名，并定制黑色主题、紧凑间距、内容滚动和折叠后的导航样式。

没有整套迁入上游路由、Mock 登录和示例业务模块。已有 NestJS、SQLite 和采购销售接口仍由本项目负责。
因此这是基于上游布局组件的集成改造，不是完整 SoybeanAdmin 模板替换；完整参考仓库也没有安装或启动。

## 后续维护

从 references 仓库阅读和比较上游变化；更新 vendor 前核对差异并保留许可证。
不要直接更新 vendor 后覆盖本项目业务代码。上游完整工程使用 pnpm workspace，若独立运行应按其 README 操作。

## Vben Admin 引入（2026-09-17）

- 本地完整仓库：references/vue-vben-admin。
- 上游：https://github.com/vbenjs/vue-vben-admin。
- 提交：df014ae70924b2af011de26d08082d7ebed787df。
- MIT，Copyright (c) 2024-present, Vben。
- 实际引入：packages/effects/hooks/src/use-pagination.ts，保存在 apps/customer-web/src/vendor/vben/use-pagination.ts，文件哈希与克隆版本一致。
- 主题参考：packages/@core/base/design/src/design-tokens/dark.css。提取背景、卡片、边界和文本色阶，改为 gf 前缀变量，保存在 vendor/vben/tokens.css；LICENSE 同目录保留。
- 应用位置：客户业务端三类列表的分页、workspace-theme.css 的暗色层次。未替换为完整 Vben 工程，原 Soybean 布局继续使用。

客户页面现在支持表格/卡片切换、商品排序、客户端分页、修改商品、清除筛选和 / 快捷搜索。手机自动采用卡片布局。
分页为浏览器内分页，服务器仍一次返回工作区数据；生产大数据量场景需改为 API 分页。
