# 温州斜条批发 Web管理后台 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建温州斜条批发Web管理后台，与小程序共享CloudBase数据库，提供桌面端高效管理能力

**Architecture:** Vue 3 + Element Plus 前端（Vite构建），CloudBase HTTP云函数后端（JWT鉴权），两边共享同一CloudBase文档数据库。前端部署到CloudBase静态托管，后端云函数与小程序云函数共存于同一环境。

**Tech Stack:** Vue 3, Vite, Element Plus, ECharts 5, Pinia, Vue Router 4, axios, xlsx (SheetJS), CloudBase HTTP云函数, jsonwebtoken, PBKDF2-SHA512

**Spec:** [2026-06-20-web-admin-design.md](../specs/2026-06-20-web-admin-design.md)

---

## 文件结构总览

```
E:/web-admin/                          # 前端项目（新建）
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── api/
│   │   ├── request.js                 # axios实例 + JWT拦截器
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── orders.js
│   │   ├── products.js
│   │   ├── customers.js
│   │   ├── pricing.js
│   │   ├── finance.js
│   │   ├── admins.js
│   │   ├── logs.js
│   │   └── settings.js
│   ├── router/
│   │   └── index.js
│   ├── stores/
│   │   └── user.js                    # Pinia用户状态
│   ├── utils/
│   │   └── export.js                  # Excel导出工具
│   ├── views/
│   │   ├── login/
│   │   │   └── index.vue
│   │   ├── dashboard/
│   │   │   └── index.vue
│   │   ├── orders/
│   │   │   ├── index.vue              # 订单列表
│   │   │   └── PrintDelivery.vue      # 打印发货单组件
│   │   ├── products/
│   │   │   └── index.vue
│   │   ├── customers/
│   │   │   ├── index.vue              # 客户列表
│   │   │   └── detail.vue             # 客户详情
│   │   ├── pricing/
│   │   │   └── index.vue
│   │   ├── finance/
│   │   │   └── index.vue
│   │   ├── admins/
│   │   │   └── index.vue
│   │   ├── logs/
│   │   │   └── index.vue
│   │   └── settings/
│   │       └── index.vue
│   └── components/
│       └── AppLayout.vue              # 侧边栏+顶栏+主内容区布局

E:/miniprogram/cloudfunctions/         # 后端云函数（新增）
├── lib/
│   └── jwtAuth.js                     # Web端JWT鉴权模块（新增文件）
├── adminLoginWeb/                     # 以下为新增HTTP云函数
│   ├── index.js
│   ├── config.json
│   └── package.json
├── adminGetDashboard/
│   ├── index.js
│   ├── config.json
│   └── package.json
├── adminWebOrders/                    # 合并订单相关操作（list/detail/update/batch）
│   ├── index.js
│   ├── config.json
│   └── package.json
├── adminWebProducts/                  # 合并产品相关操作
│   ├── index.js
│   ├── config.json
│   └── package.json
├── adminWebCustomers/                 # 合并客户相关操作
│   ├── index.js
│   ├── config.json
│   └── package.json
├── adminWebPrices/                    # 合并定价相关操作
│   ├── index.js
│   ├── config.json
│   └── package.json
├── adminWebFinance/                   # 合并财务相关操作
│   ├── index.js
│   ├── config.json
│   └── package.json
├── adminWebAdmins/                    # 合并管理员管理操作
│   ├── index.js
│   ├── config.json
│   └── package.json
├── adminWebLogs/                      # 操作日志
│   ├── index.js
│   ├── config.json
│   └── package.json
└── adminWebSettings/                  # 系统设置
    ├── index.js
    ├── config.json
    └── package.json
```

### 云函数合并策略

Web后台约28个API端点，按模块合并为10个HTTP云函数（每个模块一个入口），通过URL路径路由分发：

| 云函数 | 处理的路由 |
|--------|-----------|
| `adminLoginWeb` | POST `/login` |
| `adminGetDashboard` | GET `/dashboard` |
| `adminWebOrders` | GET/PUT `/orders`, GET `/orders/:id`, POST `/orders/batch`, GET `/orders/export` |
| `adminWebProducts` | GET/POST/PUT `/products`, POST `/products/batch`, GET `/products/export`, POST `/products/import` |
| `adminWebCustomers` | GET/POST/PUT `/customers`, GET `/customers/:phone`, POST `/customers/import`, GET `/customers/export` |
| `adminWebPrices` | GET/POST `/prices`, POST `/prices/batch`, POST `/prices/import` |
| `adminWebFinance` | GET `/finance`, POST `/finance/payment`, GET `/finance/payments` |
| `adminWebAdmins` | GET/POST/PUT `/admins`, PUT `/admins/password` |
| `adminWebLogs` | GET `/logs` |
| `adminWebSettings` | GET/PUT `/settings` |

---

## Phase 1: 项目脚手架与基础设施

### Task 1: 创建前端项目并安装依赖

**Files:**
- Create: `E:/web-admin/package.json`
- Create: `E:/web-admin/vite.config.js`
- Create: `E:/web-admin/index.html`

- [ ] **Step 1: 创建项目目录并初始化package.json**

```bash
mkdir E:/web-admin
cd E:/web-admin
```

写入 `E:/web-admin/package.json`：
```json
{
  "name": "xietiao-admin",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.0",
    "element-plus": "^2.7.0",
    "@element-plus/icons-vue": "^2.3.0",
    "echarts": "^5.5.0",
    "axios": "^1.7.0",
    "xlsx": "^0.18.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd E:/web-admin && npm install
```

- [ ] **Step 3: 创建 vite.config.js**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://cloudbase-d6g98vaoyb7ec331a.service.tcloudbase.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

- [ ] **Step 4: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>温州斜条批发 - 管理后台</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Commit**

```bash
cd E:/web-admin && git init && git add -A && git commit -m "chore: scaffold Vue 3 + Vite + Element Plus project"
```

---

### Task 2: 创建前端基础框架（main.js, App.vue, router, store, axios）

**Files:**
- Create: `E:/web-admin/src/main.js`
- Create: `E:/web-admin/src/App.vue`
- Create: `E:/web-admin/src/router/index.js`
- Create: `E:/web-admin/src/stores/user.js`
- Create: `E:/web-admin/src/api/request.js`
- Create: `E:/web-admin/src/components/AppLayout.vue`

- [ ] **Step 1: 创建 main.js**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#app')
```

- [ ] **Step 2: 创建 api/request.js（axios实例 + JWT拦截器）**

```js
import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: '/api/admin',
  timeout: 15000
})

// 请求拦截：注入JWT
request.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：处理401/403
request.interceptors.response.use(
  response => {
    const data = response.data
    if (data.code !== 0) {
      ElMessage.error(data.msg || '操作失败')
      return Promise.reject(new Error(data.msg))
    }
    return data
  },
  error => {
    if (error.response) {
      const status = error.response.status
      if (status === 401) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        router.replace('/login')
        ElMessage.error('登录已过期，请重新登录')
      } else if (status === 403) {
        ElMessage.error('无权限执行此操作')
      } else {
        ElMessage.error('操作失败，请稍后重试')
      }
    } else {
      ElMessage.error('网络错误，请检查网络')
    }
    return Promise.reject(error)
  }
)

export default request
```

- [ ] **Step 3: 创建 stores/user.js（Pinia用户状态）**

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi } from '@/api/auth'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const username = ref(localStorage.getItem('admin_user') || '')
  const nickname = ref(localStorage.getItem('admin_nick') || '')
  const role = ref(localStorage.getItem('admin_role') || '')

  const isLoggedIn = computed(() => !!token.value)
  const isManager = computed(() => role.value === 'manager')
  const isDelivery = computed(() => role.value === 'delivery')
  const isWarehouse = computed(() => role.value === 'warehouse')

  async function doLogin(form) {
    const res = await loginApi(form)
    const d = res.data
    token.value = d.token
    username.value = d.username
    nickname.value = d.nickname
    role.value = d.role
    localStorage.setItem('admin_token', d.token)
    localStorage.setItem('admin_user', d.username)
    localStorage.setItem('admin_nick', d.nickname)
    localStorage.setItem('admin_role', d.role)
    router.replace('/dashboard')
  }

  function doLogout() {
    token.value = ''
    username.value = ''
    nickname.value = ''
    role.value = ''
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_nick')
    localStorage.removeItem('admin_role')
    router.replace('/login')
  }

  return { token, username, nickname, role, isLoggedIn, isManager, isDelivery, isWarehouse, doLogin, doLogout }
})
```

- [ ] **Step 4: 创建 router/index.js**

```js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '仪表盘', role: 'manager' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('@/views/orders/index.vue'),
        meta: { title: '订单管理' }
      },
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/products/index.vue'),
        meta: { title: '产品管理', role: 'manager' }
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('@/views/customers/index.vue'),
        meta: { title: '客户管理', role: 'manager' }
      },
      {
        path: 'customers/:phone',
        name: 'CustomerDetail',
        component: () => import('@/views/customers/detail.vue'),
        meta: { title: '客户详情', role: 'manager' }
      },
      {
        path: 'pricing',
        name: 'Pricing',
        component: () => import('@/views/pricing/index.vue'),
        meta: { title: '专属定价', role: 'manager' }
      },
      {
        path: 'finance',
        name: 'Finance',
        component: () => import('@/views/finance/index.vue'),
        meta: { title: '财务管理', role: 'manager' }
      },
      {
        path: 'admins',
        name: 'Admins',
        component: () => import('@/views/admins/index.vue'),
        meta: { title: '管理员管理', role: 'manager' }
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/logs/index.vue'),
        meta: { title: '操作日志', role: 'manager' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue'),
        meta: { title: '系统设置', role: 'manager' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫：未登录跳登录页，无权限跳仪表盘
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')
  const role = localStorage.getItem('admin_role') || ''

  if (to.path !== '/login' && !token) {
    next('/login')
    return
  }
  if (to.path === '/login' && token) {
    next('/dashboard')
    return
  }
  // 角色权限校验
  if (to.meta.role && to.meta.role === 'manager' && role !== 'manager') {
    // 非厂长访问厂长专属页面时，重定向到订单页
    if (role === 'delivery' || role === 'warehouse') {
      next('/orders')
      return
    }
  }
  next()
})

export default router
```

- [ ] **Step 5: 创建 App.vue**

```vue
<template>
  <router-view />
</template>

<script setup>
</script>

<style>
body { margin: 0; font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
</style>
```

- [ ] **Step 6: 创建 AppLayout.vue（侧边栏+顶栏布局）**

```vue
<template>
  <el-container style="height: 100vh">
    <el-aside :width="isCollapse ? '64px' : '220px'" style="transition: width 0.3s; background: #304156; overflow-x: hidden">
      <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; font-weight: bold; white-space: nowrap">
        <span v-if="!isCollapse">温州斜条批发</span>
        <span v-else>斜条</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        router
      >
        <el-menu-item v-if="userStore.isManager" index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Document /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <template v-if="userStore.isManager">
          <el-menu-item index="/products">
            <el-icon><Goods /></el-icon>
            <span>产品管理</span>
          </el-menu-item>
          <el-menu-item index="/customers">
            <el-icon><User /></el-icon>
            <span>客户管理</span>
          </el-menu-item>
          <el-menu-item index="/pricing">
            <el-icon><PriceTag /></el-icon>
            <span>专属定价</span>
          </el-menu-item>
          <el-menu-item index="/finance">
            <el-icon><Money /></el-icon>
            <span>财务管理</span>
          </el-menu-item>
          <el-menu-item index="/admins">
            <el-icon><Setting /></el-icon>
            <span>管理员</span>
          </el-menu-item>
          <el-menu-item index="/logs">
            <el-icon><Tickets /></el-icon>
            <span>操作日志</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Tools /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="height: 60px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e6e6e6; padding: 0 20px">
        <div style="display: flex; align-items: center">
          <el-button @click="isCollapse = !isCollapse" :icon="isCollapse ? 'Expand' : 'Fold'" text />
          <el-breadcrumb separator="/" style="margin-left: 10px">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ $route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="color: #606266">{{ userStore.nickname || userStore.username }}</span>
          <el-tag :type="userStore.isManager ? 'danger' : 'warning'" size="small">
            {{ userStore.isManager ? '厂长' : userStore.isDelivery ? '送货员' : '仓库调货员' }}
          </el-tag>
          <el-button type="danger" text @click="handleLogout">退出</el-button>
        </div>
      </el-header>

      <el-main style="background: #f0f2f5; padding: 20px">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()
const isCollapse = ref(false)
const activeMenu = computed(() => route.path)

function handleLogout() {
  userStore.doLogout()
}
</script>
```

- [ ] **Step 7: 验证项目能跑起来**

```bash
cd E:/web-admin && npm run dev
```

预期：浏览器打开 `http://localhost:3000`，显示空白登录页（因为路由守卫重定向到 `/login`，login组件还不存在，先确认无编译错误即可）。

- [ ] **Step 8: Commit**

```bash
cd E:/web-admin && git add -A && git commit -m "feat: add project foundation (router, store, axios, layout)"
```

---

## Phase 2: 认证系统

### Task 3: 创建JWT鉴权模块（后端）

**Files:**
- Create: `E:/miniprogram/cloudfunctions/lib/jwtAuth.js`
- Create: `E:/miniprogram/cloudfunctions/adminLoginWeb/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminLoginWeb/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminLoginWeb/package.json`

- [ ] **Step 1: 安装 jsonwebtoken 到共享 lib 目录**

```bash
cd E:/miniprogram/cloudfunctions/lib
npm init -y
npm install jsonwebtoken
```

- [ ] **Step 2: 创建 lib/jwtAuth.js**

```js
/**
 * Web管理后台 JWT 鉴权模块
 *
 * 小程序端用 OPENID 鉴权，Web端用 JWT 鉴权。
 * 两者独立，互不依赖。
 *
 * Usage:
 *   const { sign, verify, requireJwt } = require('../lib/jwtAuth');
 *
 *   // 签发 token
 *   const token = sign({ username: 'changzhang', role: 'manager' });
 *
 *   // HTTP 云函数中校验
 *   const r = requireJwt(event);
 *   if (!r.authorized) return r.response;
 */

const jwt = require('jsonwebtoken')

// JWT密钥（生产环境应通过环境变量注入，此处用固定值便于初期开发）
const JWT_SECRET = process.env.JWT_SECRET || 'xietiao-admin-jwt-secret-2026'
const TOKEN_EXPIRES = '24h'

/**
 * 签发JWT
 * @param {object} payload - { username, role, nickname }
 * @returns {string}
 */
function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES })
}

/**
 * 校验JWT
 * @param {string} token
 * @returns {{ valid: true, payload: object } | { valid: false, error: string }}
 */
function verify(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return { valid: true, payload }
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, error: '登录已过期' }
    }
    return { valid: false, error: '无效的登录凭证' }
  }
}

/**
 * 从HTTP event中提取并校验JWT
 * @param {object} event - HTTP触发器传入的event对象
 * @returns {{ authorized: true, user: object } | { authorized: false, response: object }}
 */
function requireJwt(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return {
      authorized: false,
      response: { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 401, msg: '请先登录' }) }
    }
  }

  const result = verify(token)
  if (!result.valid) {
    return {
      authorized: false,
      response: { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 401, msg: result.error }) }
    }
  }

  return { authorized: true, user: result.payload }
}

/**
 * 构建HTTP成功响应
 */
function httpOk(data) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ code: 0, data })
  }
}

/**
 * 构建HTTP错误响应
 */
function httpError(code, msg, httpStatus) {
  return {
    statusCode: httpStatus || 400,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ code, msg })
  }
}

module.exports = { sign, verify, requireJwt, httpOk, httpError, JWT_SECRET }
```

- [ ] **Step 3: 创建 adminLoginWeb/config.json**

```json
{
  "permissions": {
    "openapi": []
  },
  "timeout": 15,
  "triggers": [
    {
      "name": "http",
      "type": "http",
      "config": {
        "path": "/api/admin/login"
      }
    }
  ]
}
```

Wait — CloudBase HTTP触发器path配置。实际上 CloudBase HTTP 云函数的路径是在云函数名称层面控制的。我们改用更实际的配置：

```json
{
  "permissions": {},
  "timeout": 15
}
```

> **注意**：CloudBase HTTP触发器的实际路径需要在云开发控制台或通过 `cloudbaserc.json` 配置。当前方案是每个云函数处理一个路径前缀（如 `/api/admin/orders`），通过函数名路由。实际部署时需要在 CloudBase 控制台为每个函数开启HTTP触发器并配置路径。或者更简单的做法：所有web admin请求走一个统一入口云函数 `adminWebApi`，内部根据path分发。但为了清晰，本计划采用多函数方案。

- [ ] **Step 4: 创建 adminLoginWeb/package.json**

```json
{
  "name": "adminLoginWeb",
  "version": "1.0.0",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 5: 创建 adminLoginWeb/index.js**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')
const { sign, httpOk, httpError } = require('../lib/jwtAuth')
const logger = require('../lib/logger')

// PBKDF2-SHA512 密码验证（与小程序端 adminLogin 保持一致）
function verifyPassword(password, salt, hash) {
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return derived === hash
}

exports.main = async (event) => {
  // HTTP触发器：只处理POST
  if (event.httpMethod !== 'POST') {
    return httpError(405, 'Method Not Allowed', 405)
  }

  let body
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
  } catch (e) {
    return httpError(400, '请求格式错误')
  }

  const { username, password } = body || {}
  if (!username || !password) {
    return httpError(400, '请输入用户名和密码')
  }

  try {
    const result = await db.collection('admins')
      .where({ username: username.trim() })
      .get()

    if (result.data.length === 0) {
      logger.warn('adminLoginWeb', { username, reason: 'user not found' })
      return httpError(-1, '账号或密码错误')
    }

    const admin = result.data[0]

    // 检查是否被禁用
    if (admin.status === 'disabled') {
      return httpError(-1, '账号已被禁用，请联系管理员')
    }

    // 检查锁定状态
    if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
      const minutes = Math.ceil((admin.lockedUntil - Date.now()) / 60000)
      return httpError(-1, `账号已锁定，请${minutes}分钟后再试`)
    }

    // 验证密码
    let passwordOk = false
    if (admin.passwordHash && admin.salt) {
      passwordOk = verifyPassword(password, admin.salt, admin.passwordHash)
    } else if (admin.password) {
      // 兼容旧版明文密码
      passwordOk = (password === admin.password)
    }

    if (!passwordOk) {
      // 增加失败计数
      const failedAttempts = (admin.failedAttempts || 0) + 1
      const updateData = { failedAttempts: db.command.inc(1) }
      if (failedAttempts >= 5) {
        updateData.lockedUntil = Date.now() + 15 * 60 * 1000
      }
      await db.collection('admins').doc(admin._id).update({ data: updateData })
      logger.warn('adminLoginWeb', { username, reason: 'wrong password', attempts: failedAttempts })
      return httpError(-1, failedAttempts >= 5 ? '密码错误次数过多，账号已锁定15分钟' : '账号或密码错误')
    }

    // 登录成功
    await db.collection('admins').doc(admin._id).update({
      data: {
        failedAttempts: 0,
        lockedUntil: db.command.remove(),
        lastLoginAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    const token = sign({
      username: admin.username,
      role: admin.role,
      nickname: admin.nickname || admin.username
    })

    logger.info('adminLoginWeb', { username, role: admin.role })

    return httpOk({
      token,
      username: admin.username,
      role: admin.role,
      nickname: admin.nickname || admin.username
    })
  } catch (err) {
    logger.error('adminLoginWeb', err)
    return httpError(500, '登录失败，请稍后重试', 500)
  }
}
```

- [ ] **Step 6: 创建前端登录页面 api/auth.js**

```js
import request from './request'

export function login(data) {
  return request.post('/login', data)
}
```

- [ ] **Step 7: 创建前端登录页面 views/login/index.vue**

```vue
<template>
  <div class="login-container">
    <div class="login-card">
      <h2 style="text-align: center; margin-bottom: 30px; color: #303133">温州斜条批发 - 管理后台</h2>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="0" size="large">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="width: 100%" :loading="loading" @click="handleLogin">登 录</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const formRef = ref(null)
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await userStore.doLogin(form)
  } catch (e) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}
</style>
```

- [ ] **Step 8: 验证登录流程**

```bash
# 部署 adminLoginWeb 云函数
cd E:/miniprogram
bash deploy.sh

# 或单独部署
tcb fn deploy adminLoginWeb --force

# 测试HTTP调用
curl -X POST https://cloudbase-d6g98vaoyb7ec331a.service.tcloudbase.com/adminLoginWeb \
  -H "Content-Type: application/json" \
  -d '{"username":"changzhang","password":"123456"}'
```

预期返回：`{"code":0,"data":{"token":"eyJ...","username":"changzhang","role":"manager","nickname":"厂长"}}`

- [ ] **Step 9: Commit**

```bash
cd E:/miniprogram && git add cloudfunctions/lib/jwtAuth.js cloudfunctions/adminLoginWeb/ && git commit -m "feat: add JWT auth lib and adminLoginWeb cloud function"
cd E:/web-admin && git add -A && git commit -m "feat: add login page and auth API"
```

---

## Phase 3: 仪表盘

### Task 4: 仪表盘云函数

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminGetDashboard/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminGetDashboard/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminGetDashboard/package.json`

- [ ] **Step 1: 创建 config.json 和 package.json**

`config.json`:
```json
{ "permissions": {}, "timeout": 20 }
```

`package.json`:
```json
{ "name": "adminGetDashboard", "version": "1.0.0", "dependencies": { "wx-server-sdk": "~2.6.3" } }
```

- [ ] **Step 2: 创建 adminGetDashboard/index.js**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireJwt, httpOk, httpError } = require('../lib/jwtAuth')
const logger = require('../lib/logger')

exports.main = async (event) => {
  const auth = requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') {
    return httpError(403, '无权限', 403)
  }

  // 解析日期范围
  const qs = event.queryStringParameters || {}
  const range = qs.range || 'today'  // today / 7days / 30days
  const now = Date.now()
  let rangeStart
  if (range === 'today') {
    rangeStart = new Date()
    rangeStart.setHours(0, 0, 0, 0)
    rangeStart = rangeStart.getTime()
  } else if (range === '7days') {
    rangeStart = now - 7 * 86400000
  } else {
    rangeStart = now - 30 * 86400000
  }

  try {
    // 并行拉取全部订单和产品
    const orderTotal = await db.collection('orders').count()
    const productTotal = await db.collection('products').count()

    // 分页拉取所有订单（dashboard需要全量做聚合）
    const PAGE = 200
    const orderPages = Math.ceil(orderTotal.total / PAGE)
    const orderCalls = []
    for (let i = 0; i < Math.min(orderPages, 5); i++) {  // 最多1000条，保证性能
      orderCalls.push(db.collection('orders').skip(i * PAGE).limit(PAGE).orderBy('createdAt', 'desc').get())
    }
    const orderResults = await Promise.all(orderCalls)
    const allOrders = orderResults.flatMap(r => r.data)

    const productPages = Math.ceil(productTotal.total / PAGE)
    const productCalls = []
    for (let i = 0; i < Math.min(productPages, 5); i++) {
      productCalls.push(db.collection('products').skip(i * PAGE).limit(PAGE).get())
    }
    const productResults = await Promise.all(productCalls)
    const allProducts = productResults.flatMap(r => r.data)

    // 范围过滤
    const rangeOrders = allOrders.filter(o => {
      const t = o.createdAt ? (typeof o.createdAt === 'number' ? o.createdAt : new Date(o.createdAt).getTime()) : 0
      return t >= rangeStart
    })

    // 概览卡片
    const totalOrders = rangeOrders.length
    const totalSales = rangeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const pendingOrders = rangeOrders.filter(o => o.status === 'processing').length
    const unpaidAmount = allOrders.filter(o => o.payment_status === 'unpaid')
      .reduce((sum, o) => sum + (o.totalAmount || 0) - (o.paid_amount || 0), 0)
    const shortageCount = allProducts.filter(p => p.status === 'out' || p.status === 'low').length

    // 近7天趋势（按天聚合）
    const trendDays = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const dayOrders = allOrders.filter(o => {
        const t = o.createdAt ? (typeof o.createdAt === 'number' ? o.createdAt : new Date(o.createdAt).getTime()) : 0
        return t >= dayStart.getTime() && t < dayEnd.getTime()
      })
      const daySales = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
      trendDays.push({
        label: (dayStart.getMonth() + 1) + '/' + dayStart.getDate(),
        orders: dayOrders.length,
        sales: Math.round(daySales / 100)
      })
    }

    // 产品销售额
    const productSales = {}
    rangeOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const pid = item.productId
        if (!pid) return
        productSales[pid] = (productSales[pid] || 0) + (item.price || 0) * (item.quantity || 0)
      })
    })

    // 品类销售额（关联产品表查品类）
    const productMap = {}
    allProducts.forEach(p => { productMap[p._id] = p })

    const categorySales = {}
    rangeOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const product = productMap[item.productId]
        const cat = product ? product.category : '未知'
        categorySales[cat] = (categorySales[cat] || 0) + (item.price || 0) * (item.quantity || 0)
      })
    })
    const categoryPie = Object.entries(categorySales)
      .map(([name, value]) => ({ name, value: Math.round(value / 100) }))
      .sort((a, b) => b.value - a.value)

    // 产品排行Top10
    const topProducts = allProducts
      .map(p => ({
        _id: p._id, name: p.name, category: p.category, unit: p.unit,
        sales: Math.round((productSales[p._id] || 0) / 100)
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10)

    // 客户排行Top10
    const custMap = {}
    rangeOrders.forEach(o => {
      const key = o.phone || '未知'
      if (!custMap[key]) {
        custMap[key] = { name: o.customerName || '未知', phone: key, amount: 0, orders: 0 }
      }
      custMap[key].amount += (o.totalAmount || 0)
      custMap[key].orders += 1
    })
    const topCustomers = Object.values(custMap)
      .map(c => ({ ...c, amount: Math.round(c.amount / 100) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    // 缺货预警
    const shortageProducts = allProducts
      .filter(p => p.status === 'out' || p.status === 'low')
      .map(p => ({
        _id: p._id, name: p.name, status: p.status,
        category: p.category, unit: p.unit,
        stock: p.stock || 0,
        sales: Math.round((productSales[p._id] || 0) / 100)
      }))
      .sort((a, b) => a.status === 'out' ? -1 : 1)

    return httpOk({
      overview: {
        totalOrders, totalSales: Math.round(totalSales / 100),
        pendingOrders, unpaidAmount: Math.round(unpaidAmount / 100),
        shortageCount
      },
      trendDays,
      categoryPie,
      topProducts,
      topCustomers,
      shortageProducts
    })
  } catch (err) {
    logger.error('adminGetDashboard', err)
    return httpError(500, '加载失败，请稍后重试', 500)
  }
}
```

- [ ] **Step 3: 部署云函数**

```bash
cd E:/miniprogram && bash deploy.sh
```

- [ ] **Step 4: Commit**

```bash
cd E:/miniprogram && git add cloudfunctions/adminGetDashboard/ && git commit -m "feat: add adminGetDashboard cloud function"
```

---

### Task 5: 仪表盘前端页面

**Files:**
- Create: `E:/web-admin/src/api/dashboard.js`
- Create: `E:/web-admin/src/views/dashboard/index.vue`

- [ ] **Step 1: 创建 api/dashboard.js**

```js
import request from './request'

export function getDashboard(range = 'today') {
  return request.get('/dashboard', { params: { range } })
}
```

- [ ] **Step 2: 创建 views/dashboard/index.vue**

```vue
<template>
  <div>
    <!-- 日期切换 -->
    <div style="margin-bottom: 20px">
      <el-radio-group v-model="dateRange" @change="loadData" size="default">
        <el-radio-button value="today">今天</el-radio-button>
        <el-radio-button value="7days">近7天</el-radio-button>
        <el-radio-button value="30days">近30天</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 概览卡片 -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="4" v-for="card in overviewCards" :key="card.label">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 14px; color: #909399; margin-bottom: 8px">{{ card.label }}</div>
            <div :style="{ fontSize: '28px', fontWeight: 'bold', color: card.color }">
              <span ref="countRefs">{{ card.display }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 趋势图 + 品类饼图 -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="16">
        <el-card>
          <template #header>近7天订单趋势</template>
          <div ref="trendChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>品类销售占比</template>
          <div ref="categoryChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 产品排行 + 客户排行 -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>产品销量排行 Top10</template>
          <div ref="productChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>客户消费排行 Top10</template>
          <div ref="customerChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 缺货预警 -->
    <el-card v-if="shortageProducts.length > 0">
      <template #header>
        <span style="color: #f56c6c">缺货/紧张预警 ({{ shortageProducts.length }})</span>
      </template>
      <el-table :data="shortageProducts" size="small">
        <el-table-column prop="name" label="产品名称" />
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'out' ? 'danger' : 'warning'" size="small">
              {{ row.status === 'out' ? '缺货' : '紧张' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" />
        <el-table-column prop="sales" label="近30天销量(元)" width="130" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { getDashboard } from '@/api/dashboard'

const dateRange = ref('today')
const overviewCards = reactive([
  { label: '订单数', display: '0', color: '#409EFF', key: 'totalOrders' },
  { label: '销售额(元)', display: '0', color: '#67C23A', key: 'totalSales' },
  { label: '待处理', display: '0', color: '#E6A23C', key: 'pendingOrders' },
  { label: '未收款(元)', display: '0', color: '#F56C6C', key: 'unpaidAmount' },
  { label: '缺货SKU', display: '0', color: '#909399', key: 'shortageCount' }
])
const shortageProducts = ref([])

// 图表refs
const trendChartRef = ref(null)
const categoryChartRef = ref(null)
const productChartRef = ref(null)
const customerChartRef = ref(null)
let trendChart, categoryChart, productChart, customerChart

function initCharts() {
  if (trendChartRef.value) trendChart = echarts.init(trendChartRef.value)
  if (categoryChartRef.value) categoryChart = echarts.init(categoryChartRef.value)
  if (productChartRef.value) productChart = echarts.init(productChartRef.value)
  if (customerChartRef.value) customerChart = echarts.init(customerChartRef.value)
  window.addEventListener('resize', handleResize)
}

function handleResize() {
  trendChart?.resize()
  categoryChart?.resize()
  productChart?.resize()
  customerChart?.resize()
}

function animateValue(cards, data) {
  cards.forEach(card => {
    const target = data[card.key]
    const start = parseInt(card.display) || 0
    const diff = target - start
    if (diff === 0) { card.display = String(target); return }
    const duration = 600
    const startTime = Date.now()
    function tick() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      card.display = String(Math.round(start + diff * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function loadData() {
  try {
    const res = await getDashboard(dateRange.value)
    const d = res.data

    // 更新概览卡片（数字滚动动画）
    animateValue(overviewCards, d.overview)

    // 更新缺货列表
    shortageProducts.value = d.shortageProducts || []

    await nextTick()

    // 趋势图
    if (trendChart && d.trendDays) {
      trendChart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['订单数', '销售额'] },
        xAxis: { type: 'category', data: d.trendDays.map(t => t.label) },
        yAxis: [
          { type: 'value', name: '订单数' },
          { type: 'value', name: '销售额(元)' }
        ],
        series: [
          { name: '订单数', type: 'bar', data: d.trendDays.map(t => t.orders), itemStyle: { color: '#409EFF' } },
          { name: '销售额', type: 'line', yAxisIndex: 1, data: d.trendDays.map(t => t.sales), itemStyle: { color: '#67C23A' } }
        ]
      }, true)
    }

    // 品类饼图
    if (categoryChart && d.categoryPie) {
      categoryChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
        series: [{
          type: 'pie', radius: ['45%', '75%'], center: ['50%', '55%'],
          data: d.categoryPie,
          label: { formatter: '{b}\n{d}%' }
        }]
      }, true)
    }

    // 产品排行
    if (productChart && d.topProducts) {
      productChart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: { type: 'value', name: '销售额(元)' },
        yAxis: { type: 'category', data: d.topProducts.map(p => p.name).reverse(), axisLabel: { width: 80, overflow: 'truncate' } },
        series: [{ type: 'bar', data: d.topProducts.map(p => p.sales).reverse(), itemStyle: { color: '#409EFF' } }],
        grid: { left: 90, right: 20 }
      }, true)
    }

    // 客户排行
    if (customerChart && d.topCustomers) {
      customerChart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: { type: 'value', name: '消费额(元)' },
        yAxis: { type: 'category', data: d.topCustomers.map(c => c.name).reverse(), axisLabel: { width: 80, overflow: 'truncate' } },
        series: [{ type: 'bar', data: d.topCustomers.map(c => c.amount).reverse(), itemStyle: { color: '#67C23A' } }],
        grid: { left: 90, right: 20 }
      }, true)
    }
  } catch (e) {
    // 错误已在请求拦截器中处理
  }
}

onMounted(() => {
  initCharts()
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  categoryChart?.dispose()
  productChart?.dispose()
  customerChart?.dispose()
})
</script>
```

- [ ] **Step 3: 验证仪表盘**

```bash
cd E:/web-admin && npm run dev
```

浏览器打开 `http://localhost:3000`，登录后应自动跳转到仪表盘，显示卡片数据和图表。

- [ ] **Step 4: Commit**

```bash
cd E:/web-admin && git add -A && git commit -m "feat: add dashboard with ECharts and animated counters"
```

---

## Phase 4: 订单管理

### Task 6: 订单管理云函数

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminWebOrders/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminWebOrders/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminWebOrders/package.json`

- [ ] **Step 1: 创建 adminWebOrders/config.json 和 package.json**

```json
{ "permissions": {}, "timeout": 20 }
```

```json
{ "name": "adminWebOrders", "version": "1.0.0", "dependencies": { "wx-server-sdk": "~2.6.3" } }
```

- [ ] **Step 2: 创建 adminWebOrders/index.js（路由分发）**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireJwt, httpOk, httpError } = require('../lib/jwtAuth')
const { logOperation } = require('../lib/operationLog')
const logger = require('../lib/logger')

exports.main = async (event) => {
  const auth = requireJwt(event)
  if (!auth.authorized) return auth.response

  const method = event.httpMethod
  const path = event.path || ''
  const qs = event.queryStringParameters || {}
  let body = {}
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}) } catch (e) {}

  // 路由：GET /orders — 列表
  if (method === 'GET' && path === '/orders') {
    return handleList(auth.user, qs)
  }
  // 路由：GET /orders/:id — 详情
  if (method === 'GET' && path.startsWith('/orders/')) {
    const id = path.split('/orders/')[1]
    return handleDetail(auth.user, id)
  }
  // 路由：PUT /orders/:id — 修改订单
  if (method === 'PUT' && path.startsWith('/orders/')) {
    const id = path.split('/orders/')[1]
    return handleUpdate(auth.user, id, body)
  }
  // 路由：POST /orders/batch — 批量操作
  if (method === 'POST' && path === '/orders/batch') {
    return handleBatch(auth.user, body)
  }
  // 路由：GET /orders/export — 导出
  if (method === 'GET' && path === '/orders/export') {
    return handleExport(auth.user, qs)
  }

  return httpError(404, 'Not Found', 404)
}

// --- 列表 ---
async function handleList(user, qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 100)
    const where = {}

    if (qs.status) where.status = qs.status
    if (qs.payment_status) where.payment_status = qs.payment_status
    if (qs.deliveryMethod) where.deliveryMethod = qs.deliveryMethod

    // 角色过滤
    if (user.role === 'delivery') where.deliveryMethod = 'delivery'
    if (user.role === 'warehouse') where.deliveryMethod = 'logistics'

    // 日期范围
    if (qs.startDate || qs.endDate) {
      where.createdAt = {}
      if (qs.startDate) where.createdAt = _.gte(new Date(qs.startDate).getTime())
      if (qs.endDate) where.createdAt = { ...where.createdAt, ..._.lte(new Date(qs.endDate).getTime() + 86400000) }
    }

    // 模糊搜索
    if (qs.keyword) {
      const kw = qs.keyword.trim()
      where.$or = [
        { customerName: db.RegExp({ regexp: kw, options: 'i' }) },
        { phone: db.RegExp({ regexp: kw, options: 'i' }) }
      ]
    }

    const [countRes, listRes] = await Promise.all([
      db.collection('orders').where(where).count(),
      db.collection('orders').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])

    const list = listRes.data.map(o => ({
      _id: o._id,
      customerName: o.customerName,
      phone: o.phone,
      address: o.address,
      itemsSummary: (o.items || []).map(i => i.name + '×' + i.quantity).join('、'),
      totalAmount: o.totalAmount,
      discount: o.discount,
      deliveryMethod: o.deliveryMethod,
      status: o.status,
      payment_status: o.payment_status,
      paid_amount: o.paid_amount || 0,
      pickedUp: o.pickedUp || false,
      remark: o.remark,
      returnRequest: o.returnRequest,
      createdAt: o.createdAt
    }))

    return httpOk({ list, total: countRes.total, page, pageSize })
  } catch (err) {
    logger.error('adminWebOrders.list', err)
    return httpError(500, '加载失败', 500)
  }
}

// --- 详情 ---
async function handleDetail(user, orderId) {
  try {
    const res = await db.collection('orders').doc(orderId).get()
    if (!res.data) return httpError(404, '订单不存在')
    return httpOk({ record: res.data })
  } catch (err) {
    logger.error('adminWebOrders.detail', err)
    return httpError(500, '加载失败', 500)
  }
}

// --- 修改订单 ---
async function handleUpdate(user, orderId, body) {
  try {
    const order = await db.collection('orders').doc(orderId).get()
    if (!order.data) return httpError(404, '订单不存在')

    const updateData = { updatedAt: db.serverDate() }
    let logAction = ''
    let logDetail = ''

    if (body.status) {
      updateData.status = body.status
      logAction = 'order.status'
      logDetail = `订单状态改为${body.status === 'completed' ? '已完成' : body.status === 'cancelled' ? '已取消' : body.status}`
    }
    if (body.payment_status) {
      updateData.payment_status = body.payment_status
      if (body.payment_status === 'paid') {
        updateData.paid_amount = order.data.totalAmount
      }
    }
    if (body.totalAmount !== undefined) {
      updateData.totalAmount = body.totalAmount
      if (!logAction) { logAction = 'order.price'; logDetail = `订单金额改为${(body.totalAmount / 100).toFixed(2)}元` }
    }
    if (body.pickedUp !== undefined) updateData.pickedUp = body.pickedUp
    if (body.remark !== undefined) updateData.remark = body.remark

    await db.collection('orders').doc(orderId).update({ data: updateData })

    // 写操作日志
    if (logAction) {
      await logOperation(db, user.username, logAction, `订单${orderId}`, logDetail)
    }

    return httpOk({})
  } catch (err) {
    logger.error('adminWebOrders.update', err)
    return httpError(500, '操作失败', 500)
  }
}

// --- 批量操作 ---
async function handleBatch(user, body) {
  try {
    const { ids, action } = body
    if (!ids || !ids.length) return httpError(400, '请选择订单')
    if (!action) return httpError(400, '请指定操作类型')

    const updateData = { updatedAt: db.serverDate() }
    let logDetail = ''

    if (action === 'complete') {
      updateData.status = 'completed'
      logDetail = `批量完成${ids.length}个订单`
    } else if (action === 'cancel') {
      updateData.status = 'cancelled'
      logDetail = `批量取消${ids.length}个订单`
    } else {
      return httpError(400, '不支持的操作类型')
    }

    await db.collection('orders').where({ _id: _.in(ids) }).update({ data: updateData })
    await logOperation(db, user.username, 'order.status', `批量(${ids.length}单)`, logDetail)

    return httpOk({ affected: ids.length })
  } catch (err) {
    logger.error('adminWebOrders.batch', err)
    return httpError(500, '批量操作失败', 500)
  }
}

// --- 导出 ---
async function handleExport(user, qs) {
  // 导出逻辑同列表但不分页，最多返回1000条给前端生成Excel
  try {
    const where = {}
    if (qs.status) where.status = qs.status
    if (qs.deliveryMethod) where.deliveryMethod = qs.deliveryMethod
    if (user.role === 'delivery') where.deliveryMethod = 'delivery'
    if (user.role === 'warehouse') where.deliveryMethod = 'logistics'

    if (qs.keyword) {
      const kw = qs.keyword.trim()
      where.$or = [
        { customerName: db.RegExp({ regexp: kw, options: 'i' }) },
        { phone: db.RegExp({ regexp: kw, options: 'i' }) }
      ]
    }

    const res = await db.collection('orders').where(where).limit(1000).orderBy('createdAt', 'desc').get()
    return httpOk({ list: res.data })
  } catch (err) {
    logger.error('adminWebOrders.export', err)
    return httpError(500, '导出失败', 500)
  }
}
```

- [ ] **Step 3: 创建操作日志模块 lib/operationLog.js**

```js
/**
 * 操作日志模块
 * 所有关键操作通过此模块写入 operationLogs 集合
 */

/**
 * 记录操作日志
 * @param {object} db - CloudBase database实例
 * @param {string} operator - 操作人用户名
 * @param {string} action - 操作类型
 * @param {string} target - 操作对象
 * @param {string} detail - 操作详情
 */
async function logOperation(db, operator, action, target, detail) {
  try {
    await db.collection('operationLogs').add({
      data: {
        operator,
        action,
        target,
        detail,
        createdAt: db.serverDate()
      }
    })
  } catch (err) {
    // 日志写入失败不应阻断主流程
    console.error('logOperation failed:', err.message)
  }
}

module.exports = { logOperation }
```

- [ ] **Step 4: 部署云函数**

```bash
cd E:/miniprogram && bash deploy.sh
```

- [ ] **Step 5: Commit**

```bash
cd E:/miniprogram && git add cloudfunctions/adminWebOrders/ cloudfunctions/lib/operationLog.js && git commit -m "feat: add adminWebOrders cloud function and operationLog lib"
```

---

### Task 7: 订单管理前端页面

**Files:**
- Create: `E:/web-admin/src/api/orders.js`
- Create: `E:/web-admin/src/views/orders/index.vue`
- Create: `E:/web-admin/src/utils/export.js`
- Create: `E:/web-admin/src/views/orders/PrintDelivery.vue`

- [ ] **Step 1: 创建 api/orders.js**

```js
import request from './request'

export function getOrders(params) {
  return request.get('/orders', { params })
}

export function getOrderDetail(id) {
  return request.get(`/orders/${id}`)
}

export function updateOrder(id, data) {
  return request.put(`/orders/${id}`, data)
}

export function batchUpdateOrders(data) {
  return request.post('/orders/batch', data)
}

export function exportOrders(params) {
  return request.get('/orders/export', { params })
}
```

- [ ] **Step 2: 创建 utils/export.js**

```js
import * as XLSX from 'xlsx'

/**
 * 将数据导出为Excel并触发下载
 * @param {Array} data - 数据行
 * @param {Array} columns - 列定义 [{ prop: 'name', label: '名称' }]
 * @param {string} filename - 文件名（不含扩展名）
 */
export function exportToExcel(data, columns, filename) {
  const headers = columns.map(c => c.label)
  const rows = data.map(row => columns.map(c => row[c.prop] ?? ''))
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // 设置列宽
  sheet['!cols'] = columns.map(() => ({ wch: 18 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
```

- [ ] **Step 3: 创建 views/orders/index.vue**（核心页面，代码较长）

```vue
<template>
  <div>
    <!-- 搜索筛选栏 -->
    <el-card style="margin-bottom: 16px">
      <el-row :gutter="12" align="middle">
        <el-col :span="4">
          <el-input v-model="filters.keyword" placeholder="客户名/手机号" clearable @clear="handleSearch" @keyup.enter="handleSearch" />
        </el-col>
        <el-col :span="3">
          <el-select v-model="filters.status" placeholder="订单状态" clearable @change="handleSearch">
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-select v-model="filters.payment_status" placeholder="付款状态" clearable @change="handleSearch">
            <el-option label="未付款" value="unpaid" />
            <el-option label="已付款" value="paid" />
          </el-select>
        </el-col>
        <el-col :span="3" v-if="userStore.isManager">
          <el-select v-model="filters.deliveryMethod" placeholder="拿货方式" clearable @change="handleSearch">
            <el-option label="配送" value="delivery" />
            <el-option label="自取" value="pickup" />
            <el-option label="物流" value="logistics" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-date-picker v-model="filters.dateRange" type="daterange" range-separator="至"
            start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD"
            style="width: 100%" @change="handleSearch" />
        </el-col>
        <el-col :span="5">
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleExport" :loading="exportLoading">导出</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 批量操作栏 -->
    <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center">
      <el-button type="success" size="small" :disabled="selectedIds.length === 0" @click="handleBatchComplete">
        批量标记已完成 ({{ selectedIds.length }})
      </el-button>
      <el-button type="danger" size="small" :disabled="selectedIds.length === 0" @click="handleBatchCancel">
        批量取消 ({{ selectedIds.length }})
      </el-button>
      <el-button size="small" :disabled="selectedIds.length === 0" @click="handlePrintSelected">
        打印发货单 ({{ selectedIds.length }})
      </el-button>
    </div>

    <!-- 订单表格 -->
    <el-card>
      <el-table :data="orders" v-loading="loading" stripe @selection-change="handleSelectionChange" ref="tableRef"
        :default-sort="{ prop: 'createdAt', order: 'descending' }">
        <el-table-column type="selection" width="45" />
        <el-table-column label="订单号" width="120">
          <template #default="{ row }">
            <el-button type="primary" link @click="showDetail(row)">{{ row._id.slice(-8) }}</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" width="120" />
        <el-table-column prop="phone" label="电话" width="120" />
        <el-table-column prop="itemsSummary" label="商品摘要" min-width="180" show-overflow-tooltip />
        <el-table-column label="金额" width="100">
          <template #default="{ row }">¥{{ (row.totalAmount / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="付款" width="80">
          <template #default="{ row }">
            <el-tag :type="row.payment_status === 'paid' ? 'success' : 'info'" size="small">
              {{ row.payment_status === 'paid' ? '已付' : '未付' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="拿货方式" width="90">
          <template #default="{ row }">{{ { delivery: '配送', pickup: '自取', logistics: '物流' }[row.deliveryMethod] || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="showDetail(row)">详情</el-button>
            <el-dropdown @command="(cmd) => handleAction(row, cmd)" style="margin-left: 6px">
              <el-button size="small">更多<el-icon><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="complete">标记已完成</el-dropdown-item>
                  <el-dropdown-item command="cancel">取消订单</el-dropdown-item>
                  <el-dropdown-item command="changePrice">修改价格</el-dropdown-item>
                  <el-dropdown-item command="togglePickedUp">{{ row.pickedUp ? '标记未拿货' : '标记已拿货' }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 16px; display: flex; justify-content: flex-end">
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize"
          :total="pagination.total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next"
          @size-change="loadOrders" @current-change="loadOrders" />
      </div>
    </el-card>

    <!-- 订单详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="订单详情" size="500px">
      <template v-if="currentOrder">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="订单号">{{ currentOrder._id }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentOrder.customerName }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ currentOrder.phone }}</el-descriptions-item>
          <el-descriptions-item label="地址">{{ currentOrder.address }}</el-descriptions-item>
          <el-descriptions-item label="金额">¥{{ (currentOrder.totalAmount / 100).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="折扣">{{ currentOrder.discount ? (currentOrder.discount * 100).toFixed(0) + '%' : '无' }}</el-descriptions-item>
          <el-descriptions-item label="已付款">¥{{ ((currentOrder.paid_amount || 0) / 100).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="拿货方式">{{ { delivery: '配送', pickup: '自取', logistics: '物流' }[currentOrder.deliveryMethod] }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusText(currentOrder.status) }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ currentOrder.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 16px 0 8px">商品明细</h4>
        <el-table :data="currentOrder.items || []" size="small">
          <el-table-column prop="name" label="商品" />
          <el-table-column label="单价" width="80">
            <template #default="{ row }">¥{{ (row.price / 100).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="60" />
          <el-table-column prop="unit" label="单位" width="60" />
          <el-table-column label="小计" width="90">
            <template #default="{ row }">¥{{ ((row.price * row.quantity) / 100).toFixed(2) }}</template>
          </el-table-column>
        </el-table>

        <!-- 退换货信息 -->
        <template v-if="currentOrder.returnRequest">
          <h4 style="margin: 16px 0 8px; color: #e6a23c">退换货申请</h4>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="类型">{{ currentOrder.returnRequest.type === 'return' ? '退货' : '换货' }}</el-descriptions-item>
            <el-descriptions-item label="原因">{{ currentOrder.returnRequest.reason || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ { pending: '待处理', approved: '已通过', rejected: '已拒绝', completed: '已完成' }[currentOrder.returnRequest.status] }}</el-descriptions-item>
          </el-descriptions>
          <div style="margin-top: 8px; display: flex; gap: 8px" v-if="currentOrder.returnRequest.status === 'pending'">
            <el-button type="success" size="small" @click="handleReturn('approve')">通过</el-button>
            <el-button type="danger" size="small" @click="handleReturn('reject')">拒绝</el-button>
          </div>
        </template>
      </template>
    </el-drawer>

    <!-- 改价弹窗 -->
    <el-dialog v-model="priceDialogVisible" title="修改订单价格" width="350px">
      <el-form>
        <el-form-item label="新价格（元）">
          <el-input-number v-model="newPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmChangePrice">确认</el-button>
      </template>
    </el-dialog>

    <!-- 打印组件（隐藏） -->
    <PrintDelivery ref="printRef" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getOrders, getOrderDetail, updateOrder, batchUpdateOrders, exportOrders } from '@/api/orders'
import { exportToExcel } from '@/utils/export'
import PrintDelivery from './PrintDelivery.vue'

const userStore = useUserStore()
const loading = ref(false)
const exportLoading = ref(false)
const orders = ref([])
const selectedIds = ref([])
const tableRef = ref(null)
const printRef = ref(null)

const filters = reactive({
  keyword: '',
  status: '',
  payment_status: '',
  deliveryMethod: '',
  dateRange: null
})

const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const drawerVisible = ref(false)
const currentOrder = ref(null)
const priceDialogVisible = ref(false)
const priceTargetOrder = ref(null)
const newPrice = ref(0)

const exportColumns = [
  { prop: '_id', label: '订单号' },
  { prop: 'customerName', label: '客户名称' },
  { prop: 'phone', label: '电话' },
  { prop: 'itemsSummary', label: '商品摘要' },
  { prop: 'totalAmountText', label: '金额(元)' },
  { prop: 'statusText', label: '状态' },
  { prop: 'paymentText', label: '付款状态' },
  { prop: 'deliveryText', label: '拿货方式' },
  { prop: 'createdAtText', label: '下单时间' }
]

function statusTag(s) { return { processing: 'warning', completed: 'success', cancelled: 'info' }[s] || 'info' }
function statusText(s) { return { processing: '处理中', completed: '已完成', cancelled: '已取消' }[s] || s }
function formatTime(t) {
  if (!t) return '-'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function loadOrders() {
  loading.value = true
  try {
    const params = { ...pagination }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.status) params.status = filters.status
    if (filters.payment_status) params.payment_status = filters.payment_status
    if (filters.deliveryMethod) params.deliveryMethod = filters.deliveryMethod
    if (filters.dateRange && filters.dateRange.length === 2) {
      params.startDate = filters.dateRange[0]
      params.endDate = filters.dateRange[1]
    }
    const res = await getOrders(params)
    orders.value = res.data.list
    pagination.total = res.data.total
  } catch (e) { /* handled */ }
  finally { loading.value = false }
}

function handleSearch() { pagination.page = 1; loadOrders() }
function handleReset() {
  filters.keyword = ''
  filters.status = ''
  filters.payment_status = ''
  filters.deliveryMethod = ''
  filters.dateRange = null
  handleSearch()
}

function handleSelectionChange(rows) { selectedIds.value = rows.map(r => r._id) }

async function showDetail(row) {
  try {
    const res = await getOrderDetail(row._id)
    currentOrder.value = res.data.record
    drawerVisible.value = true
  } catch (e) { /* handled */ }
}

async function handleAction(row, cmd) {
  if (cmd === 'complete') {
    try { await updateOrder(row._id, { status: 'completed' }); ElMessage.success('已标记为完成'); loadOrders() } catch (e) {}
  } else if (cmd === 'cancel') {
    try {
      await ElMessageBox.confirm('确定取消该订单？', '确认', { type: 'warning' })
      await updateOrder(row._id, { status: 'cancelled' })
      ElMessage.success('已取消')
      loadOrders()
    } catch (e) { /* cancelled */ }
  } else if (cmd === 'changePrice') {
    priceTargetOrder.value = row
    newPrice.value = row.totalAmount / 100
    priceDialogVisible.value = true
  } else if (cmd === 'togglePickedUp') {
    try { await updateOrder(row._id, { pickedUp: !row.pickedUp }); ElMessage.success(row.pickedUp ? '已标记未拿货' : '已标记已拿货'); loadOrders() } catch (e) {}
  }
}

async function confirmChangePrice() {
  try {
    await updateOrder(priceTargetOrder.value._id, { totalAmount: Math.round(newPrice.value * 100) })
    ElMessage.success('价格已更新')
    priceDialogVisible.value = false
    loadOrders()
  } catch (e) {}
}

async function handleBatchComplete() {
  try {
    await ElMessageBox.confirm(`确定将选中的${selectedIds.value.length}个订单标记为已完成？`, '确认')
    await batchUpdateOrders({ ids: selectedIds.value, action: 'complete' })
    ElMessage.success('批量操作完成')
    selectedIds.value = []
    loadOrders()
  } catch (e) {}
}

async function handleBatchCancel() {
  try {
    await ElMessageBox.confirm(`确定取消选中的${selectedIds.value.length}个订单？`, '确认', { type: 'warning' })
    await batchUpdateOrders({ ids: selectedIds.value, action: 'cancel' })
    ElMessage.success('批量操作完成')
    selectedIds.value = []
    loadOrders()
  } catch (e) {}
}

async function handleExport() {
  exportLoading.value = true
  try {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.deliveryMethod) params.deliveryMethod = filters.deliveryMethod
    if (filters.keyword) params.keyword = filters.keyword
    const res = await exportOrders(params)
    const list = (res.data.list || []).map(o => ({
      _id: o._id,
      customerName: o.customerName,
      phone: o.phone,
      itemsSummary: o.itemsSummary,
      totalAmountText: (o.totalAmount / 100).toFixed(2),
      statusText: statusText(o.status),
      paymentText: o.payment_status === 'paid' ? '已付' : '未付',
      deliveryText: { delivery: '配送', pickup: '自取', logistics: '物流' }[o.deliveryMethod] || '-',
      createdAtText: formatTime(o.createdAt)
    }))
    exportToExcel(list, exportColumns, `订单导出_${new Date().toISOString().slice(0, 10)}`)
  } catch (e) {}
  finally { exportLoading.value = false }
}

function handlePrintSelected() {
  const selected = orders.value.filter(o => selectedIds.value.includes(o._id))
  if (selected.length === 0) { ElMessage.warning('请先选择订单'); return }
  printRef.value.print(selected)
}

async function handleReturn(action) {
  try {
    // 退换货审核 — 调用现有小程序云函数（此处简化，实际应新建Web版退换货处理）
    await updateOrder(currentOrder.value._id, {
      returnRequest: { ...currentOrder.value.returnRequest, status: action === 'approve' ? 'approved' : 'rejected' }
    })
    ElMessage.success(action === 'approve' ? '已通过退换货申请' : '已拒绝退换货申请')
    showDetail(currentOrder.value)
    loadOrders()
  } catch (e) {}
}

onMounted(() => { loadOrders() })
</script>
```

- [ ] **Step 4: 创建 views/orders/PrintDelivery.vue**

```vue
<template>
  <div style="display: none">
    <div ref="printArea">
      <div v-for="order in printOrders" :key="order._id" style="page-break-after: always; padding: 20px; font-size: 12px">
        <h2 style="text-align: center; margin-bottom: 16px">温州斜条批发 — 发货单</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px">
          <tr><td style="width: 80px; padding: 4px">订单号：</td><td>{{ order._id }}</td><td style="width: 80px">日期：</td><td>{{ formatTime(order.createdAt) }}</td></tr>
          <tr><td>客户：</td><td>{{ order.customerName }}</td><td>电话：</td><td>{{ order.phone }}</td></tr>
          <tr><td>地址：</td><td colspan="3">{{ order.address }}</td></tr>
          <tr><td>备注：</td><td colspan="3">{{ order.remark || '-' }}</td></tr>
        </table>
        <table style="width: 100%; border-collapse: collapse" border="1">
          <thead><tr><th>商品</th><th>单价</th><th>数量</th><th>单位</th><th>小计</th></tr></thead>
          <tbody>
            <tr v-for="item in order.items" :key="item.productId">
              <td style="padding: 4px">{{ item.name }}</td>
              <td style="text-align: right">¥{{ (item.price / 100).toFixed(2) }}</td>
              <td style="text-align: center">{{ item.quantity }}</td>
              <td style="text-align: center">{{ item.unit }}</td>
              <td style="text-align: right">¥{{ ((item.price * item.quantity) / 100).toFixed(2) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td colspan="4" style="text-align: right; font-weight: bold">合计：</td><td style="text-align: right; font-weight: bold">¥{{ (order.totalAmount / 100).toFixed(2) }}</td></tr>
          </tfoot>
        </table>
        <div style="margin-top: 40px; display: flex; justify-content: space-between">
          <span>发货人签字：__________</span>
          <span>收货人签字：__________</span>
          <span>日期：__________</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const printOrders = ref([])
const printArea = ref(null)

function formatTime(t) {
  if (!t) return '-'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  return d.toLocaleDateString('zh-CN')
}

function print(orders) {
  printOrders.value = orders
  // 等待DOM更新后打印
  setTimeout(() => {
    const content = printArea.value.innerHTML
    const win = window.open('', '_blank', 'width=800,height=600')
    win.document.write(`<html><head><title>发货单</title><style>body{font-family:'Microsoft YaHei',sans-serif}table{border-collapse:collapse}td,th{padding:4px 8px}</style></head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }, 100)
}

defineExpose({ print })
</script>
```

- [ ] **Step 5: 验证订单管理页面**

```bash
cd E:/web-admin && npm run dev
```

登录后切换到订单管理，验证列表加载、筛选、详情弹窗、批量操作、导出Excel等功能。

- [ ] **Step 6: Commit**

```bash
cd E:/web-admin && git add -A && git commit -m "feat: add order management with detail drawer, batch ops, export, and print"
```

---

## Phase 5-12: 其余模块（产品/客户/定价/财务/管理员/日志/设置）

> 以下模块遵循与订单管理相同的模式：**云函数路由分发 + 前端表格+弹窗**。每个模块的任务结构与Phase 4一致，为节省篇幅，以下列出每个模块的关键差异化代码。

### Task 8: 产品管理模块

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminWebProducts/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminWebProducts/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminWebProducts/package.json`
- Create: `E:/web-admin/src/api/products.js`
- Create: `E:/web-admin/src/views/products/index.vue`

**云函数路由**（`adminWebProducts/index.js`）：
```
GET    /products          — 列表（分页+搜索+分类筛选）
POST   /products          — 新增产品
PUT    /products          — 编辑产品（body含_id）
POST   /products/batch    — 批量操作（批量改分类/单位/状态，批量删除）
GET    /products/export   — 导出Excel（最多1000条）
POST   /products/import   — 导入Excel（接收fileID或base64数据）
```

**关键差异化逻辑**：

1. **产品新增/编辑**：支持 `images` 数组字段（多图），同时兼容旧版 `image` 单字段
2. **库存预警**：列表返回数据中标红 `status === 'out'` 或 `status === 'low'` 的行
3. **批量操作**：`action` 支持 `update`（改分类/单位/状态）和 `delete`
4. **Excel导入**：复用现有 `importProducts` 云函数的解析逻辑，或前端解析后逐条POST

**前端关键代码**（`views/products/index.vue`）：

产品表单中包含多图上传区域：
```vue
<el-form-item label="产品图片">
  <el-upload
    :action="uploadUrl"
    list-type="picture-card"
    :file-list="imageList"
    :on-success="handleImageSuccess"
    :on-remove="handleImageRemove"
    multiple
  >
    <el-icon><Plus /></el-icon>
  </el-upload>
</el-form-item>
```

图片上传使用 CloudBase 存储上传。简化方案：前端先将图片上传到云存储获取fileID，再随表单提交。

库存预警颜色：
```vue
<el-table-column label="状态" width="80">
  <template #default="{ row }">
    <el-tag :type="row.status === 'out' ? 'danger' : row.status === 'low' ? 'warning' : 'success'" size="small">
      {{ row.status === 'out' ? '缺货' : row.status === 'low' ? '紧张' : '充足' }}
    </el-tag>
  </template>
</el-table-column>
```

**api/products.js**：
```js
import request from './request'

export function getProducts(params) { return request.get('/products', { params }) }
export function saveProduct(data) { return data._id ? request.put('/products', data) : request.post('/products', data) }
export function batchProducts(data) { return request.post('/products/batch', data) }
export function exportProducts(params) { return request.get('/products/export', { params }) }
export function importProducts(data) { return request.post('/products/import', data) }
```

---

### Task 9: 客户管理模块

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminWebCustomers/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminWebCustomers/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminWebCustomers/package.json`
- Create: `E:/web-admin/src/api/customers.js`
- Create: `E:/web-admin/src/views/customers/index.vue`
- Create: `E:/web-admin/src/views/customers/detail.vue`

**云函数路由**（`adminWebCustomers/index.js`）：
```
GET    /customers          — 列表（分页+搜索）
GET    /customers/:phone   — 客户详情（含订单历史、欠款明细、专属定价列表）
POST   /customers          — 新增客户
PUT    /customers          — 编辑客户
POST   /customers/import   — 导入Excel（批量新增/更新客户）
GET    /customers/export   — 导出Excel
```

**客户详情页**（`detail.vue`）包含三个Tab：
- 基本信息（name, phone, totalOrders, totalAmount, debt）
- 订单历史（该客户的所有订单列表）
- 专属定价（该客户的所有专属价）

云函数中客户详情聚合查询：
```js
async function handleDetail(user, phone) {
  const [customerRes, orderRes, priceRes] = await Promise.all([
    db.collection('customers').where({ phone }).get(),
    db.collection('orders').where({ phone }).orderBy('createdAt', 'desc').limit(50).get(),
    db.collection('customerPrices').where({ customerPhone: phone }).get()
  ])
  if (!customerRes.data.length) return httpError(404, '客户不存在')
  return httpOk({
    customer: customerRes.data[0],
    orders: orderRes.data,
    prices: priceRes.data
  })
}
```

**api/customers.js**：
```js
import request from './request'

export function getCustomers(params) { return request.get('/customers', { params }) }
export function getCustomerDetail(phone) { return request.get(`/customers/${phone}`) }
export function saveCustomer(data) { return data._id ? request.put('/customers', data) : request.post('/customers', data) }
export function importCustomers(data) { return request.post('/customers/import', data) }
export function exportCustomers(params) { return request.get('/customers/export', { params }) }
```

---

### Task 10: 专属定价模块

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminWebPrices/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminWebPrices/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminWebPrices/package.json`
- Create: `E:/web-admin/src/api/pricing.js`
- Create: `E:/web-admin/src/views/pricing/index.vue`

**云函数路由**（`adminWebPrices/index.js`）：
```
GET    /prices       — 定价列表（分页+筛选：按客户手机号/产品名）
POST   /prices       — 设置单条专属价（upsert: customerPhone + productId + customPrice）
POST   /prices/batch — 批量操作（批量设置/删除）
POST   /prices/import — 导入Excel批量设价
```

**价格变动记录**：每次 `POST /prices` 设置专属价时：
1. 先查 `customerPrices` 是否有旧记录
2. 如有旧记录且价格不同 → 写入 `priceHistory` 集合
3. upsert 新价格到 `customerPrices`

```js
async function setPrice(user, body) {
  const { customerPhone, productId, productName, customPrice } = body
  if (!customerPhone || !productId) return httpError(400, '客户和产品不能为空')

  // 查旧记录
  const old = await db.collection('customerPrices')
    .where({ customerPhone, productId }).get()

  if (old.data.length > 0 && old.data[0].customPrice !== customPrice) {
    // 写入变动记录
    await db.collection('priceHistory').add({
      data: {
        customerPhone,
        productId,
        oldPrice: old.data[0].customPrice,
        newPrice: customPrice,
        operator: user.username,
        createdAt: db.serverDate()
      }
    })
  }

  // upsert
  if (old.data.length > 0) {
    await db.collection('customerPrices').doc(old.data[0]._id).update({
      data: { customPrice, updatedAt: db.serverDate() }
    })
  } else {
    await db.collection('customerPrices').add({
      data: { customerPhone, productId, productName, customPrice, createdAt: db.serverDate(), updatedAt: db.serverDate() }
    })
  }

  await logOperation(db, user.username, 'pricing.set',
    `${customerPhone}/${productName || productId}`,
    `专属价设为${(customPrice / 100).toFixed(2)}元`)

  return httpOk({})
}
```

---

### Task 11: 财务管理模块

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminWebFinance/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminWebFinance/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminWebFinance/package.json`
- Create: `E:/web-admin/src/api/finance.js`
- Create: `E:/web-admin/src/views/finance/index.vue`

**云函数路由**（`adminWebFinance/index.js`）：
```
GET    /finance            — 财务总览（应收/已收/未收统计 + 欠款列表）
POST   /finance/payment    — 收款登记（orderId + amount）
GET    /finance/payments   — 收款记录列表
```

**财务总览数据结构**：
```js
{
  summary: {
    totalReceivable,  // 所有已完成订单总额
    totalPaid,        // 已收款总额
    totalUnpaid,      // 未收款总额
    overdueCount      // 欠款笔数
  },
  unpaidOrders: [...],  // 未付清订单列表
  dailyStats: [...],    // 日收入统计
  monthlyStats: [...]   // 月收入统计
}
```

**收款登记逻辑**：
```js
async function recordPayment(user, body) {
  const { orderId, amount } = body // amount 单位：分
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return httpError(404, '订单不存在')

  const newPaid = (order.data.paid_amount || 0) + amount
  const paymentStatus = newPaid >= order.data.totalAmount ? 'paid' : 'unpaid'

  await db.collection('orders').doc(orderId).update({
    data: {
      paid_amount: newPaid,
      payment_status: paymentStatus,
      updatedAt: db.serverDate()
    }
  })

  // 如果客户有欠款字段，同步更新
  if (paymentStatus === 'paid') {
    const customer = await db.collection('customers').where({ phone: order.data.phone }).get()
    if (customer.data.length > 0) {
      const newDebt = Math.max(0, (customer.data[0].debt || 0) - (order.data.totalAmount - (order.data.paid_amount || 0)))
      await db.collection('customers').doc(customer.data[0]._id).update({
        data: { debt: newDebt, updatedAt: db.serverDate() }
      })
    }
  }

  await logOperation(db, user.username, 'payment.record', `订单${orderId}`,
    `收款${(amount / 100).toFixed(2)}元，累计已收${(newPaid / 100).toFixed(2)}元`)

  return httpOk({ paid_amount: newPaid, payment_status: paymentStatus })
}
```

**前端财务页面**（`finance/index.vue`）包含：
- 概览卡片（应收/已收/未收/逾期笔数）
- 欠款列表表格 + 收款登记按钮
- ECharts月收入柱状图
- 收款记录表格

---

### Task 12: 管理员管理模块

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminWebAdmins/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminWebAdmins/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminWebAdmins/package.json`
- Create: `E:/web-admin/src/api/admins.js`
- Create: `E:/web-admin/src/views/admins/index.vue`

**云函数路由**（`adminWebAdmins/index.js`）：
```
GET    /admins            — 管理员列表
POST   /admins            — 新增管理员
PUT    /admins            — 编辑管理员（昵称/角色/状态）
PUT    /admins/password   — 修改密码（oldPassword + newPassword）
```

**新增管理员时密码哈希**（复用现有PBKDF2-SHA512逻辑）：
```js
const crypto = require('crypto')

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return { salt, hash }
}
```

**前端管理员页面**（`admins/index.vue`）：
- 表格：用户名、昵称、角色、状态、最后登录时间
- 新增弹窗：用户名、密码、昵称、角色选择
- 操作：编辑（昵称/角色）、禁用/启用、修改密码弹窗

---

### Task 13: 操作日志模块

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminWebLogs/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminWebLogs/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminWebLogs/package.json`
- Create: `E:/web-admin/src/api/logs.js`
- Create: `E:/web-admin/src/views/logs/index.vue`

**云函数路由**（`adminWebLogs/index.js`）：
```
GET    /logs    — 日志列表（分页+筛选：操作人/操作类型/日期范围）
```

**前端日志页面**（`logs/index.vue`）：纯只读表格 + 筛选条件。

---

### Task 14: 系统设置模块

**Files:**
- Create: `E:/miniprogram/cloudfunctions/adminWebSettings/index.js`
- Create: `E:/miniprogram/cloudfunctions/adminWebSettings/config.json`
- Create: `E:/miniprogram/cloudfunctions/adminWebSettings/package.json`
- Create: `E:/web-admin/src/api/settings.js`
- Create: `E:/web-admin/src/views/settings/index.vue`

**云函数路由**（`adminWebSettings/index.js`）：
```
GET    /settings    — 获取产品分类列表（从products集合distinct category）
PUT    /settings    — 保存设置（修改分类名称等）
```

**产品分类管理**逻辑：
- 从 `products` 集合聚合出所有 `category` 值及其产品数量
- 支持修改分类名（需同步更新所有引用该分类的产品）
- 不支持删除有产品在用的分类（需确认）

---

## Phase 13: 部署与收尾

### Task 15: 配置CloudBase静态托管并部署前端

**Files:**
- Modify: `E:/web-admin/vite.config.js`（生产构建配置）
- Create: `E:/miniprogram/cloudbaserc.json`（追加web云函数配置）

- [ ] **Step 1: 构建前端**

```bash
cd E:/web-admin && npm run build
# 产出在 dist/ 目录
```

- [ ] **Step 2: 部署到CloudBase静态托管**

```bash
# 安装CLI（如未安装）
npm install -g @cloudbase/cli
tcb login

# 开启静态网站托管（控制台操作或CLI）
tcb hosting enable --envId cloudbase-d6g98vaoyb7ec331a

# 上传dist目录
tcb hosting deploy dist/ --envId cloudbase-d6g98vaoyb7ec331a
```

- [ ] **Step 3: 为所有Web云函数开启HTTP触发器**

在CloudBase控制台 → 云函数 → 每个web云函数 → 触发器 → 新建HTTP触发器。

或者通过 `cloudbaserc.json` 批量配置（需确认CloudBase支持HTTP触发器的声明式配置）。

- [ ] **Step 4: 配置CORS和域名**

CloudBase HTTP云函数默认已配置 `Access-Control-Allow-Origin: *`（在 `jwtAuth.httpOk` 中）。如需自定义域名，在CloudBase控制台绑定。

- [ ] **Step 5: 验证整体流程**

```bash
# 1. 访问静态托管域名，确认登录页正常加载
# 2. 使用 changzhang / 123456 登录
# 3. 逐个模块验证：仪表盘数据、订单CRUD、产品管理、客户管理、定价、财务、管理员、日志、设置
```

- [ ] **Step 6: 更新文档**

更新 `E:/miniprogram/README.md`，添加Web管理后台的说明和访问地址。

- [ ] **Step 7: 最终Commit**

```bash
cd E:/miniprogram && git add -A && git commit -m "feat: complete web admin backend with all 9 modules"
cd E:/web-admin && git add -A && git commit -m "feat: complete web admin frontend with all 9 modules"
```

---

## 附录A: 数据库集合创建脚本

部署前需在CloudBase控制台 → 数据库 → 新建以下集合：

| 集合名 | 说明 |
|--------|------|
| `operationLogs` | 操作日志 |
| `priceHistory` | 定价变动记录 |

同时为现有 `admins` 集合新增字段（NoSQL自动兼容，无需迁移）：
- `status`: string — `'active'` / `'disabled'`，默认 `'active'`
- `createdBy`: string — 创建者用户名

为现有 `products` 集合新增字段：
- `images`: array of string — 多图fileID数组

---

## 附录B: 实现优先级建议

按照可独立交付的顺序排列：

1. **Phase 1-2**：脚手架 + 认证 — 有了登录才能用
2. **Phase 3**：仪表盘 — 登录后第一眼看到
3. **Phase 4**：订单管理 — 核心功能，送货员/仓库调货员唯一能用的模块
4. **Phase 5**：产品管理 — 厂长核心
5. **Phase 6**：客户管理 — 依赖订单数据
6. **Phase 7-9**：定价/财务/管理员 — 后期精细化运营
7. **Phase 10-11**：日志/设置 — 锦上添花
8. **Phase 12**：部署 — 收尾

每个Phase完成后可独立部署验证，不阻塞后续开发。
