# 模块拓展原则

## 新增一个功能的标准流程

### 1. 新增页面

```
步骤 1：在 pages/{域}/{功能}/ 下创建 4 个文件
  ├── {功能}.js      # Page({ ... })
  ├── {功能}.json    # { "usingComponents": {} }
  ├── {功能}.wxml    # 界面
  └── {功能}.wxss    # 样式

步骤 2：在 app.json 的 "pages" 数组末尾注册路径

步骤 3（如需要）：在 app.json 的 "tabBar.list" 中添加 Tab
```

**页面 JS 模板**：

```js
const demoStore = require('../../utils/demoStore');

Page({
  data: {
    // 所有需要响应式更新的数据在此声明
    loading: false,
    items: []
  },

  onShow() {
    // 鉴权检查（管理页面）
    // 如果是管理页面：检查 adminLoggedIn
    // 如果是客户页面：无需鉴权
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    const app = getApp();

    // 1. Demo 模式分支
    if (app.globalData.demoMode) {
      const data = demoStore.getAll(demoStore.KEYS.xxx);
      this.setData({ items: data, loading: false });
      return;
    }

    // 2. 云模式
    try {
      const res = await wx.cloud.callFunction({ name: 'xxx', data: {} });
      if (res.result && res.result.code === 0) {
        this.setData({ items: res.result.data });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    this.setData({ loading: false });
  }
});
```

### 2. 新增云函数

```
步骤 1：在 cloudfunctions/{函数名}/ 下创建 3 个文件
  ├── index.js       # exports.main = async (event) => { ... }
  ├── package.json   # { "name": "...", "dependencies": { "wx-server-sdk": "latest" } }
  └── config.json    # { "permissions": { "openapi": [] }, "timeout": 20 }

步骤 2：在 cloudbaserc.json 的 "functions" 数组中注册
  { "name": "xxx", "timeout": 20, "runtime": "Nodejs18.15", "handler": "index.main" }

步骤 3：tcb fn deploy xxx --force 部署
```

**云函数 JS 模板**：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('../lib/response');
const logger = require('../lib/logger');

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();

    // 鉴权（管理操作需要）
    if (/* 需要管理权限 */) {
      if (!wxContext.OPENID) return res.unauthorized();
      const admin = await db.collection('admins')
        .where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
      if (admin.data.length === 0) return res.forbidden();
    }

    const openid = wxContext.OPENID;

    // 参数校验
    const { param1, param2 } = event;
    if (!param1) return res.fail('参数描述不能为空');

    // 业务逻辑
    // ...
    logger.info('事件名', { key1: 'value1' });

    return res.success({ ... });

  } catch (err) {
    logger.error('函数名', err, { 入参关键字段 });
    return res.fail('操作失败，请稍后重试');
  }
};
```

### 3. 新增数据库集合

```
步骤 1：在微信云开发控制台 → 数据库 → 添加集合
步骤 2：确认集合权限设置正确：
  - 客户数据集合（orders, addresses）：仅创建者可读写
  - 管理数据集合（products, admins）：所有用户可读，仅管理员可写
  - 公共数据（returnRequests）：需根据业务设置
步骤 3：创建必需的索引（否则云函数会报错）
```

### 4. 新增工具模块

```
前端工具：utils/{name}.js
  → 在需要处 const tool = require('../../utils/{name}')

云函数共享库：cloudfunctions/lib/{name}.js
  → 在云函数中 const lib = require('../lib/{name}')
```

## 数据库集合清单

| 集合名 | 权限 | 说明 |
|--------|------|------|
| `products` | 所有用户可读 | 产品信息 |
| `orders` | 仅创建者可读写 | 订单（含 `_openid`） |
| `admins` | 所有用户可读 | 管理员账号 |
| `addresses` | 仅创建者可读写 | 客户地址簿 |
| `customers` | 所有用户可读 | 客户档案 |
| `returnRequests` | 仅创建者可读写 | 退换货申请 |
| `adminSubscriptions` | 所有用户可读 | 管理员订阅消息状态 |

## 核心约定

1. **所有客户数据必须绑定 `_openid`**：`orders`, `addresses`, `returnRequests` 在创建时必须写入当前用户的 `_openid`
2. **查询客户数据必须过滤 `_openid`**：防止用户看到别人的数据
3. **管理操作必须验证 admin 登录状态**：查 `admins` 表中 `lastLoginOpenid === OPENID && loggedIn === true`
4. **时间字段统一用 `db.serverDate()`**：不依赖客户端时钟
5. **价格以"分"为单位存储（整数）**：数据库字段 `price` 和 `totalAmount` 均为整数
6. **新增页面/云函数必须在对应配置文件中注册**：页面注册到 `app.json`，云函数注册到 `cloudbaserc.json`
