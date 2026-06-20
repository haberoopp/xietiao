# 项目目录结构规范

## 顶层结构

```
E:\miniprogram\
├── app.js                  # 小程序入口：云开发初始化 + 探活 + 全局数据
├── app.json                # 小程序配置：页面路由 + tabBar + 窗口
├── app.wxss                # 全局样式
├── project.config.json     # 微信开发者工具项目配置
├── cloudbaserc.json        # CloudBase CLI 部署配置（非交互式部署）
├── sitemap.json            # 微信搜索配置
├── .eslintrc.json          # ESLint 统一风格配置
├── .mcp.json               # CloudBase MCP 集成配置
│
├── pages/                  # 【前端页面】每个页面一个子目录
│   ├── index/              #   首页 — 产品浏览 + 购物车悬浮
│   ├── cart/               #   购物车 — 选中结算
│   ├── checkout/           #   结算页 — 下单 + 修改订单
│   ├── orders/             #   我的订单 — 客户订单列表 + 退换货
│   ├── address/            #   收货地址 — 地址簿管理
│   └── admin/              #   【管理后台】
│       ├── login/          #     登录
│       ├── dashboard/      #     仪表盘（仅厂长）
│       ├── orders/         #     订单管理 + 退换货审核
│       ├── products/       #     产品管理 + CSV导入
│       └── customers/      #     客户管理 + 折扣
│
├── cloudfunctions/         # 【后端云函数】每个云函数一个子目录
│   ├── lib/                #   【共享库】被其他云函数 require
│   │   ├── notify.js       #     订阅消息通知（客户+管理员）
│   │   ├── response.js     #     统一响应构建器
│   │   └── logger.js       #     结构化日志
│   ├── getProducts/        #   产品列表（并行 count+list）
│   ├── submitOrder/        #   客户下单
│   ├── getMyOrders/        #   客户查自己的订单
│   ├── updateOrder/        #   客户修改订单
│   ├── cancelOrder/        #   客户取消订单
│   ├── requestReturn/      #   客户申请退换货
│   ├── adminLogin/         #   管理员登录
│   ├── adminLogout/        #   管理员登出
│   ├── adminGetOrders/     #   管理员查全部订单
│   ├── adminGetReturns/    #   管理员查退换货列表
│   ├── adminUpdateOrderStatus/   # 改订单状态
│   ├── adminUpdateOrderPrice/    # 改订单金额
│   ├── adminHandleReturn/  #   处理退换货（含金额重算）
│   ├── adminAddProduct/    #   添加产品
│   ├── adminUpdateProduct/ #   更新产品
│   ├── adminDeleteProduct/ #   删除产品
│   ├── adminOrderImage/    #   上传订单图片
│   ├── adminDeleteOrderImage/ # 删除订单图片
│   ├── adminTogglePickedUp/ #  切换已拿货
│   ├── addressCRUD/        #   地址簿 CRUD
│   ├── customerCRUD/       #   客户 CRUD + upsert
│   ├── importProducts/     #   Excel 批量导入产品
│   └── initAdminAccounts/  #   初始化管理员账号
│
├── utils/                  # 【前端工具模块】
│   ├── constants.js        #   共享常量（分类/状态/模板ID）
│   ├── demoStore.js        #   Demo 模式数据存储层
│   ├── mock.js             #   演示用预置数据
│   ├── export.js           #   CSV 导出 + Canvas 对账单
│   └── util.js             #   格式化 + 校验工具
│
├── images/                 # 静态图标资源
├── custom-tab-bar/         # 自定义 TabBar 组件
└── docs/                   # 项目文档
    └── standards/          #   编码规范（当前目录）
```

## 页面命名规则

```
pages/{业务域}/{功能}/{功能}.js
```

- 一级页面直接放在 `pages/` 下（如 `pages/index/`）
- 管理后台统一放在 `pages/admin/` 下
- 每个页面包含 4 个文件：`.js` `.json` `.wxml` `.wxss`
- `.json` 至少声明 `{ "usingComponents": {} }`

## 云函数命名规则

```
cloudfunctions/{动作}{实体}/
```

- 客户操作：无前缀或动词开头（`submitOrder`、`getMyOrders`）
- 管理操作：`admin` 前缀（`adminGetOrders`、`adminHandleReturn`）
- CRUD 操作：实体 + 后缀（`addressCRUD`、`customerCRUD`）
- 每个云函数包含 4 个文件：`index.js` `package.json` `config.json` + 可选的本地 `notify.js`

## 新增文件规则

1. **新增页面**：在 `pages/` 下创建目录 → 4 文件 → 在 `app.json.pages` 数组注册
2. **新增云函数**：在 `cloudfunctions/` 下创建目录 → 3 文件（`index.js`/`package.json`/`config.json`）→ 在 `cloudbaserc.json.functions` 数组注册
3. **新增工具类**：在 `utils/` 下创建 → 在需要处 `require`
4. **新增共享云函数库**：在 `cloudfunctions/lib/` 下创建 → 各云函数通过 `require('../lib/xxx')` 引用
