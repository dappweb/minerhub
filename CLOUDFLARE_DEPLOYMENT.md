# Cloudflare 部署文档

**部署完成时间**: 2026-04-16  
**部署账号**: 达普韦伯 (137655747@qq.com)  
**部署状态**: ✅ 生产环境在线

---

## 📊 部署概览

| 组件               | 状态      | 地址                                        | 说明                           |
| ------------------ | --------- | ------------------------------------------- | ------------------------------ |
| **前端 (Pages)**   | ✅ 在线   | https://7246abcb.minerhub.pages.dev         | React + Vite 官网/管理平台     |
| **后端 (Workers)** | ✅ 在线   | https://coin-planet-api.dappweb.workers.dev | TypeScript + Vite 后台 API     |
| **数据库 (D1)**    | ✅ 初始化 | longxiaji_inventory                         | SQLite，6 张表已创建           |
| **缓存 (KV)**      | ✅ 绑定   | CACHE (06f37a3d...)                         | Nonce 防重放、数据缓存         |
| **文件存储 (R2)**  | ⚠️ 待启用 | 未配置                                      | 需在 Cloudflare 控制台手动启用 |

---

## 🚀 部署架构

```
minerhub/
├── src/                          → 前端源码（Pages）
└── backend/                       → 后端源码（Workers）
    ├── wrangler.toml             ← 绑定配置与环境变量
    ├── src/index.ts              ← Worker 入口
    ├── src/lib/auth.ts           ← 签名验证（Nonce 防重放）
    ├── src/routes/               ← API 路由
    │   ├── users.ts              ← 用户管理
    │   ├── devices.ts            ← 设备注册
    │   ├── claims.ts             ← 收益申报
    │   └── downloads.ts          ← 应用下载（需 R2）
    └── db/schema.sql             ← D1 表结构
```

---

## 🔧 当前配置

### 后端环境变量 (backend/wrangler.toml)

```toml
[vars]
JWT_SECRET = "YzQ0ODY2OTAtMGIyZi00NzAxLWE4YjItYWRkMjEyYmVmNzhiMmQ5M2QwMDEtYjk0Yy00NmI0LWIyNDEtNDU0ZGZmNWIwM2M1"
CHAIN_ID = "97"
RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/"
SUPER_TOKEN_ADDRESS = "0xE64c4FebF70aa1e0F8beF194270734fAd4d58357"
MINING_POOL_ADDRESS = "0xb2fC7507c37BBDcddBE668EF65F19534E7493eeE"
SWAP_ROUTER_ADDRESS = "0xA198d2917f97AD850c2Ea6C57cf9f5dCdFc43435"
```

### 前端环境变量 (.env.local)

```env
VITE_API_BASE_URL=https://coin-planet-api.dappweb.workers.dev
VITE_CHAIN_ID=97
VITE_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
VITE_MINING_POOL_ADDRESS=0xb2fC7507c37BBDcddBE668EF65F19534E7493eeE
VITE_SWAP_ROUTER_ADDRESS=0xA198d2917f97AD850c2Ea6C57cf9f5dCdFc43435
```

---

## ✅ 快速验证

### 1. 前端可访问性

```bash
curl -I https://7246abcb.minerhub.pages.dev
# 预期: HTTP 200
```

### 2. 后端健康检查

```bash
curl https://coin-planet-api.dappweb.workers.dev/api/health
# 预期: {"status":"healthy","chainId":"97","timestamp":"..."}
```

### 3. 数据库连接

```bash
# 后端已连接到 D1，schema 已初始化
# users, devices, claims, nonces 等表已创建
```

---

## 📝 部署变更说明

### 1. R2 兼容处理

- **问题**: 账号 D1 创建已达配额，R2 未启用
- **解决**: 后端改为可选 R2 组件，下载接口无 R2 时返回明确错误
- **文件修改**:
  - `backend/src/types/env.ts`: APP_BUCKET 改为可选
  - `backend/src/routes/downloads.ts`: 添加 R2 检查
  - `backend/wrangler.toml`: 移除 R2 绑定块

### 2. D1 临时绑定

- **问题**: 无法创建 coin-planet-db，配额已满
- **用途**: 后端临时绑定到现有库 longxiaji_inventory
- **计划**: 待账号清理旧库后切换回专用库

### 3. JWT Secret 生成

- **新增**: 生成和部署实际加密密钥取代占位符
- **用途**: 后端签名验证和 Nonce 管理

---

## 🛠️ 后续维护任务

### 高优先级

1. **[ ] 启用 R2** - 在 Cloudflare 控制台激活 R2 存储
   - 一旦启用，编辑 `backend/wrangler.toml` 恢复 R2 绑定
   - 重新部署 Worker: `npm run deploy:api`
2. **[ ] 释放 D1 配额** - 删除不再使用的 D1 库
   - 删除后创建 coin-planet-db
   - 更新 `backend/wrangler.toml` 中的 database_id
   - 重新部署: `npm run deploy:api`

### 中优先级

3. **[ ] 配置 OWNER_ADDRESS** - 设置管理员钱包地址
   - 在 `backend/wrangler.toml` 中添加 `OWNER_ADDRESS`
   - 用于 R2 上传权限控制

4. **[ ] 测试 API 端点** - 验证各接口功能
   - `/api/health` - ✅ 已验证
   - `/api/users` - 待测
   - `/api/devices` - 待测
   - `/api/claims` - 待测

### 低优先级

5. **[ ] 配置自定义域名** - 将 Pages 绑定到 minerhub.com
6. **[ ] 启用 CDN 缓存** - 优化静态资源加载速度
7. **[ ] 监控和告警** - 设置错误日志和性能指标

---

## 📚 相关命令

### 本地开发

```bash
# 前端
npm run dev

# 后端（本地 Wrangler 模拟）
cd backend
npm run dev:local

# 合约
cd contracts
npm run compile
```

### 部署

```bash
# 前端到 Pages
npm run deploy:cf

# 后端到 Workers
npm run deploy:api

# 数据库迁移
cd backend
npm run db:migrate              # 本地 D1
npm run db:migrate --remote    # 远程 D1
```

---

## 🔐 安全注意事项

1. **JWT_SECRET** - 当前已部署的密钥是生成的，建议定期轮换
2. **OWNER_ADDRESS** - 未配置，建议尽快设置以保护管理接口
3. **私密信息** - 不要提交 `.env.local` 到版本控制
4. **Nonce 防重放** - 已实现在 KV 中，TTL 5 分钟

---

## 📞 故障排查

### 后端 502 错误

- 检查 `JWT_SECRET` 是否为空或包含特殊字符
- 检查 D1 连接 ID 是否有效
- 查看 Wrangler 日志: `wrangler tail coin-planet-api`

### 前后端通信失败

- 确认 `VITE_API_BASE_URL` 是否正确指向 Workers 域名
- 检查请求头中的签名和 Nonce

### 数据库查询超时

- 检查 D1 库大小和查询复杂度
- 考虑进行 SQL 优化

---

**最后更新**: 2026-04-16  
**维护者**: 达普韦伯 团队
