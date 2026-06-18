# 温州斜条批发 UI 重设计 v2

## 设计目标

全面重构小程序 UI：简洁白底风（参考美团商家版），统一配色间距，首页单列虚拟列表，后台两栏结构。

## 配色体系

```css
--color-primary: #E8594B;        /* 主色（按钮、选中态、导航点缀） */
--color-primary-dark: #D14438;   /* 按下态 */
--color-bg: #F5F5F5;             /* 全局页面底色 */
--color-card: #FFFFFF;           /* 卡片背景 */
--color-text: #1A1A1A;           /* 标题/正文 */
--color-text-secondary: #666666; /* 辅助文字/时间戳 */
--color-success: #27AE60;        /* 已完成、库存充足 */
--color-warning: #E67E22;        /* 待处理、库存紧张 */
--color-danger: #E8594B;         /* 已取消、缺货 */
--color-border: #EEEEEE;         /* 分割线 */
--shadow-card: 0 2rpx 8rpx rgba(0,0,0,0.04);
```

## 导航栏

- 白底黑字，主色仅用于选中态指示器和小图标点缀
- 不再使用红色导航栏

## 首页 (pages/index/index)

**布局（从上到下）：**
1. **搜索栏**：白底圆角输入框，左侧搜索图标，右侧清除按钮，高度 72rpx
2. **分类横向滚动**：横向标签，选中态主色白字，未选中态灰底灰字，高度 64rpx
3. **单列商品卡片**（虚拟列表）：
   - 固定高度 200rpx，白底卡片 + 微阴影
   - 左侧 180×180rpx 商品图（圆角 8rpx）
   - 右侧信息区：商品名(单行截断) / 分类标签 / 单价(主色加粗) + 加入按钮
   - 缺货商品卡片整体降低透明度，加入按钮置灰
   - `wx:for` 遍历 `visibleItems`，`scroll-view` + `bindscroll` 驱动虚拟列表
   - itemHeight = 200rpx，buffer = 4
4. **底部悬浮购物车条**：
   - 白底 + 上阴影，显示「共 N 件 | ¥合计」+ 主色「去结算」
   - 点击展开购物车清单

**数据加载：** 分页 pageSize=20，追加到 products 数组。onScroll 触发 VirtualScroll.calc 更新 visibleItems。

**不再使用：** 双列布局、页面级 onReachBottom。

## 购物车 (pages/cart/cart)

结构不变，换上调配色间距。勾选框 + 商品信息 + 数量调整 +/- + 全选 + 合计 + 去结算。

## 结算页 (pages/checkout/checkout)

结构不变，换上调配色间距。

## 我的订单 (pages/orders/orders)

结构不变，换上调配色间距。状态筛选 + 订单卡片 + 操作按钮 + 退换货弹窗。

## 地址管理 (pages/address/address)

结构不变，换上调配色间距。

## 后台登录 (pages/admin/login/login)

居中布局：
- 顶部 logo 区：品牌图标 + 「温州斜条批发」
- 白卡表单：账号输入框 + 密码输入框 + 主色登录按钮（宽 100%）
- 简洁干净，无多余装饰

## 后台订单管理 (pages/admin/orders/orders)

**两个 tab：**

| Tab | 内容 |
|-----|------|
| 订单 | 当前订单列表（原有功能完整保留） |
| 功能 | 列表式入口：仪表盘 → 导出订单 → 客户管理 → 产品管理 → 订阅通知 |

订单卡片样式与客户端一致（换上调配色），所有管理操作保留（改状态、改价格、拍照上传、标记取货、退换货处理）。对账单按钮单独一行，不与其他操作按钮挤在一起。

## 后台产品管理 (pages/admin/products/products)

单列卡片列表：
- 左侧商品缩略图，右侧信息（名称、分类、单价、库存状态）
- 每张卡片右上角编辑/删除按钮
- 底部 FAB「+」按钮添加新产品
- 搜索栏保留

## 仪表盘 (pages/admin/dashboard/dashboard)

结构不变（日期切换 + 四指标卡 + 趋势柱状图 + 排行榜 + 缺货预警），换上调配色间距。

## 客户管理 (pages/admin/customers/customers)

结构不变，换上调配色间距。

## Tab 栏

| Tab | 页面 | 文本 |
|-----|------|------|
| 首页 | index | 首页 |
| 收货地址 | address | 地址 |
| 我的订单 | orders | 订单 |
| 后台 | admin/login | 后台 |

图标保持现有，选中色改为主色 `#E8594B`。

## Design Token

### 间距
| Token | 值 | 用途 |
|-------|-----|------|
| space-xs | 8rpx | 图标与文字间距 |
| space-sm | 16rpx | 卡片内边距 |
| space-md | 24rpx | 板块间距 |
| space-lg | 32rpx | 页面留白 |

### 字号
| Token | 值 | 用途 |
|-------|-----|------|
| text-xs | 24rpx | 标签、时间 |
| text-sm | 28rpx | 描述、辅助文字 |
| text-base | 32rpx | 标题、产品名 |
| text-lg | 36rpx | 页面标题 |
| text-price | 32rpx bold | 价格 |

### 圆角
| 元素 | 值 |
|------|-----|
| 卡片 | 12rpx |
| 按钮 | 8rpx |
| 输入框 | 8rpx |
| 标签 | 4rpx |

## 实现原则

- `app.wxss` 定义 CSS 变量作为 single source of truth
- 不改变任何业务逻辑、事件处理、数据流
- 只修改 WXML 布局结构 + WXSS 样式 + JS 中与布局相关的 data 字段
- 首页虚拟列表使用 `utils/virtual-scroll.js`（已创建），单列固定高度 200rpx
