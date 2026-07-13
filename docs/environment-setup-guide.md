# 环境治理 — 手动操作指南

> 本文档逐步指导你完成 staging 环境创建、GitHub 仓库配置、CI/CD 流水线接入。
> 预计耗时：30-45 分钟。

---

## 第一步：腾讯云账户充值（5 分钟）

当前账户余额不足，无法创建第二个 CloudBase 环境。

**操作步骤：**

1. 浏览器打开 https://console.cloud.tencent.com/expense/recharge
2. 登录你的腾讯云账号（与 CloudBase 同一个账号）
3. 选择充值金额（个人版最低 **¥10** 即可满足一个月 staging 环境费用）
4. 选择支付方式（微信/支付宝/银行卡），完成支付
5. 充值成功后，页面会显示新余额

> **为什么需要第二个环境？**
> 目前只有一个生产环境 `cloudbase-d6g98vaoyb7ec331a`。
> Staging 环境 = 独立数据库 + 独立云函数副本，
> 所有代码变更先部署到 staging 验证，确认无误后再手动推到生产。
> 这样生产环境不会因为错误代码而受影响。

---

## 第二步：创建 Staging 环境 ✅ 已完成

> **Staging 环境已创建成功**
> 
> | 项目 | 值 |
> |------|-----|
> | 环境 ID | `xietiao-staging-d4fbbn7ca552cad5` |
> | 套餐 | 体验版 |
> | 地域 | ap-shanghai |
> | 状态 | Normal |
> | 到期 | 2027-01-13 |
>
> 全部 39 个云函数已部署到 staging，健康检查通过（6/6 集合正常）。

---

## 第三步：创建腾讯云 API 密钥（3 分钟）

CI/CD 流水线需要 API 密钥才能自动部署。**不要用子账号密码，用 API 密钥。**

**操作步骤：**

1. 浏览器打开 https://console.cloud.tencent.com/cam/capi
2. 如果提示"账号比较新"或"安全提醒"，点确认跳过
3. 点击 **「新建密钥」** 按钮（蓝色）
4. 弹出窗口中会显示两个值：

   ```
   SecretId:  AKIDxxxxxxxxxxxxxxxxxxxxxxxxxx
   SecretKey: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

5. **立即复制这两个值**，保存到安全的地方（关掉弹窗后 SecretKey 就再也看不到了）

   > 💡 建议新建一个文本文件保存在桌面：
   > ```
   > SecretId:  AKID...
   > SecretKey: ...
   > Staging Env ID: cloudbase-xxxxxx
   > ```

6. 点击「确认」关闭窗口

---

## 第四步：在 GitHub 创建仓库（5 分钟）

### 4.1 创建仓库

1. 浏览器打开 https://github.com/new
2. 填写表单：
   - **Repository name**: `xietiao-miniprogram`（或其他你喜欢的名字）
   - **Description**: `温州斜条批发 — 微信小程序 + Web管理后台`
   - **Public / Private**: 建议选 **Private**（代码包含商业信息）
   - **不要**勾选 "Add a README file"（项目已有代码）
   - **不要**勾选 ".gitignore"（项目已有）
   - **不要**勾选 "Choose a license"
3. 点击绿色 **「Create repository」** 按钮
4. 创建成功后，页面会显示一个 URL：
   ```
   https://github.com/你的用户名/xietiao-miniprogram.git
   ```
5. **复制这个 URL**

### 4.2 推送代码到 GitHub

回到终端，依次运行以下命令：

```bash
# 1. 进入项目目录
cd E:/miniprogram

# 2. 关联远程仓库（把下面 URL 换成你自己的）
git remote add origin https://github.com/你的用户名/xietiao-miniprogram.git

# 3. 确认 remote 已添加
git remote -v
# 应该输出：
# origin  https://github.com/你的用户名/xietiao-miniprogram.git (fetch)
# origin  https://github.com/你的用户名/xietiao-miniprogram.git (push)

# 4. 推送代码（首次推送）
git push -u origin master
```

**如果弹窗要求登录 GitHub：**
- 选择 "Sign in with your browser"
- 或者用 GitHub Personal Access Token：
  1. 去 https://github.com/settings/tokens → Generate new token (classic)
  2. 勾选 `repo` 权限，生成 token
  3. 终端输入密码时粘贴 token（不是 GitHub 密码）

---

## 第五步：配置 GitHub Secrets（5 分钟）

GitHub Actions 需要三个密钥才能访问 CloudBase。

**操作步骤：**

1. 打开你的 GitHub 仓库页面
2. 点击顶部 **「Settings」** 标签
3. 左侧菜单 → **「Secrets and variables」** → **「Actions」**
4. 点击绿色 **「New repository secret」** 按钮
5. 逐个添加以下三个 secret：

---

### Secret 1: `TCB_SECRET_ID`

| 字段 | 填写内容 |
|------|---------|
| Name | `TCB_SECRET_ID` |
| Secret | 粘贴第三步保存的 **SecretId**（AKID 开头的那串） |

点击「Add secret」保存。

---

### Secret 2: `TCB_SECRET_KEY`

| 字段 | 填写内容 |
|------|---------|
| Name | `TCB_SECRET_KEY` |
| Secret | 粘贴第三步保存的 **SecretKey** |

点击「Add secret」保存。

---

### Secret 3: `TCB_ENV_STAGING`

| 字段 | 填写内容 |
|------|---------|
| Name | `TCB_ENV_STAGING` |
| Secret | 粘贴第二步创建的新 **Environment ID**（cloudbase- 开头） |

点击「Add secret」保存。

---

**最终确认：** 页面应显示 3 个 secret：

```
TCB_ENV_STAGING   ***
TCB_SECRET_ID     ***
TCB_SECRET_KEY    ***
```

---

## 第六步：验证 CI/CD 流水线（2 分钟）

代码推送后，GitHub Actions 会自动触发。

1. 打开 GitHub 仓库 → 点击顶部 **「Actions」** 标签
2. 查看名为 **「Deploy」** 的工作流运行
3. 点击进入，查看 `deploy-staging` job 的日志
4. 确认以下步骤全部绿色 ✓：
   - Install CloudBase CLI
   - Login to CloudBase
   - Deploy all functions to staging
   - Health check
5. 如果健康检查通过，说明 staging 环境部署成功！

---

## 第七步：完成生产环境运行时标准化（3 分钟）

> 这一步确保生产环境所有云函数统一使用 Nodejs18.15。

```bash
cd E:/miniprogram
bash deploy.sh
```

`deploy.sh` 会自动：
1. 复制 lib 共享模块到各云函数目录
2. 并行部署全部 40 个云函数（全部 `Nodejs18.15`）
3. 清理复制的 lib 文件
4. 运行健康检查

**验证：**
```bash
tcb fn list --env-id cloudbase-d6g98vaoyb7ec331a
```
确认所有函数的 Runtime 列都显示 `Nodejs18.15`（不应再出现 `Nodejs16.13`）。

---

## 完成后的日常流程

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  修改代码     │ ──→ │ git commit       │ ──→ │ git push origin  │
│  (本地开发)   │     │                  │     │ master           │
└──────────────┘     └──────────────────┘     └───────┬──────────┘
                                                      │
                                          ┌───────────▼──────────┐
                                          │ GitHub Actions       │
                                          │ 自动部署到 staging    │
                                          │ + 健康检查            │
                                          └───────────┬──────────┘
                                                      │
                                          ┌───────────▼──────────┐
                                          │ 手动触发             │
                                          │ deploy-production    │
                                          │ 部署到生产环境        │
                                          └──────────────────────┘
```

**推生产步骤：**
1. GitHub 仓库 → Actions → Deploy → Run workflow
2. 选择 `environment: production`
3. 点击 Run workflow
4. 等待完成（约 3-5 分钟）

---

## 遇到问题？

| 问题 | 解决方法 |
|------|---------|
| `tcb env create` 提示余额不足 | 回到第一步，确认充值已到账 |
| `git push` 提示认证失败 | 使用 Personal Access Token（见第四步） |
| GitHub Actions 部署失败 | 检查 Secrets 是否拼写正确（区分大小写） |
| 健康检查失败 | 检查 staging 环境是否已创建，运行 `tcb env list` |
| `deploy.sh` 部分函数部署失败 | 重试一次，网络波动可能导致个别函数超时 |
