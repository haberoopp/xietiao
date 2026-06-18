# 温州斜条批发 — 开发规范索引

> 本文档索引所有编码规范、架构约定和最佳实践。所有开发者（含 AI 辅助编码）在新增或修改代码时必须遵循。

| 规范 | 文件 | 覆盖范围 |
|------|------|---------|
| 代码风格 | [coding-standards.md](coding-standards.md) | JS/WXML/WXSS 语法、命名、注释 |
| 项目目录 | [project-structure.md](project-structure.md) | 目录职责、文件命名、路径约定 |
| API 返回标准 | [api-response.md](api-response.md) | 云函数返回值统一格式、错误码 |
| 错误处理 | [error-handling.md](error-handling.md) | try/catch 模式、降级策略、Toast 规范 |
| 日志记录 | [logging.md](logging.md) | 日志级别、结构化格式、存储策略 |
| 模块拓展 | [module-extension.md](module-extension.md) | 新增页面/云函数/工具类的方法和注册 |

## 快速检查清单

新增一个功能时，按以下顺序自检：

1. [ ] 云函数返回是否使用 `response.success()` / `response.fail()`？
2. [ ] 是否有 try/catch + 统一错误返回？
3. [ ] 关键操作是否通过 `logger` 记录了结构化日志？
4. [ ] 新增页面是否在 `app.json` 的 `pages` 中注册？
5. [ ] 新增云函数是否有 `config.json`（timeout ≥ 10s）和 `package.json`？
6. [ ] 客户端是否对云函数调用做了 demo 模式的降级分支？
7. [ ] 涉及 `_openid` 的数据查询是否正确过滤？
8. [ ] 新增的管理操作是否做了 admin 鉴权？

## 工具支持

- **共享库**：`cloudfunctions/lib/response.js` — 统一响应构建器
- **共享库**：`cloudfunctions/lib/logger.js` — 结构化日志
- **ESLint**：根目录 `.eslintrc.json` — 团队统一风格

## 架构与设计文档

| 文档 | 文件 | 说明 |
|------|------|------|
| 系统架构总览 | [../architecture-overview.md](../architecture-overview.md) | 架构全景图、数据流、技术决策、安全模型、性能策略 |
| 数据模型 | [../data-model.md](../data-model.md) | 7 个集合的完整 Schema（字段/类型/约束/关系） |
| API 接口 | [../api-reference.md](../api-reference.md) | 25 个云函数的入参/出参/错误码/副作用 |
| 部署文档 | [../deployment.md](../deployment.md) | 环境信息、部署流程、回滚策略、常见问题 |
