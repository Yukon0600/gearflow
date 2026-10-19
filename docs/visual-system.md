# 客户端字体与圆角

## 配色

右上角「外观」提供星云紫（默认）、深海蓝、曜石金、暮光玫瑰、月岩银五套深色主题。选择保存在浏览器 `localStorage` 的 `gearflow-theme` 中，刷新后保留；存储不可用时仍可在当前页面切换。

主题变量与组件配色位于 `apps/customer-web/src/color-themes.css`，切换器位于 `apps/customer-web/src/components/ThemePicker.vue`。主色、辅助色、底色、表面色和按钮文字色成套调整，警告与错误保持独立语义色。切换器支持键盘 Tab、Enter 和 Escape，点击外部收起，并适配移动端与减少动态效果设置。

## 字体与圆角

配置入口：`apps/customer-web/src/design-tokens.css`。

只修改 `--radius-scale`，即可同时调整客户业务端库存、采购、销售、往来单位、盘点页面及弹窗的非圆形圆角：

- `0.8`：更利落。
- `1`：默认，按钮/输入框 10px，卡片 14px，桌面抽屉左侧 20px。
- `1.2`：更柔和，对应 12px、16.8px、24px。

基础档位为 4 / 6 / 10 / 14 / 20px，均乘同一倍率。状态圆点、圆形头像保留 50%；贴合屏幕的移动端抽屉与直角边界保留 0。新增组件使用 `--radius-xs/sm/md/lg/xl`，不要再写独立像素值。

英文字母和数字使用 Inter Variable，中文使用 Noto Sans SC Variable（思源黑体），由 Fontsource 包随应用本地部署，不请求 Google Fonts。字体使用 OFL-1.1 许可，许可证保留在对应依赖包中。中文字体按 Unicode 分片，由浏览器按页面字符按需加载；部署时需要保留构建产物全部字体文件。

字重、字号层级与等宽数字规则集中在 `apps/customer-web/src/typography.css`。当前改动覆盖客户业务端，不修改独立的旧管理端原型及第三方源码。
