# MinerHub 设计文档索引

完整的 MinerHub 系统设计包括三个核心文档：

## 📋 核心设计文档

### 1. [代币模型与挖矿设计](./token-model.md)
涵盖 MM 代币的完整经济模型设计，包括：
- **代币分配方案**：总供应 10 亿 MM，50% 挖矿奖励 + 50% 各类储备
- **App 挖矿绑定**：设备注册、TEE 硬件加密、防作弊机制
- **挖矿奖励逻辑**：线性释放、难度调整、每日分配规则
- **Swap 兑换机制**：MM/USDT AMM 池、费用结构、流动性管理
- **智能合约架构**：5 个核心合约、部署脚本、经济平衡模型

**适用人群**：产品经理、运营、合约开发者

---

### 2. [后台管理系统设计](./admin-system-design.md)
详细的运营后台系统架构，包括：
- **用户管理模块**：用户搜索、状态管理、详情查看、批量操作
- **矿机监控模块**：设备实时监控、算力统计、健康监控、异常预警
- **收益管理模块**：收益统计、提现审核、链上查询、财务报表
- **风控反作弊模块**：风险检测规则、多维度风险评估、处置流程
- **系统配置管理**：可调参数、多签批准、配置历史、审计日志
- **后端 API 列表**：所有 REST 接口的详细定义（请求/响应格式）
- **技术栈与部署**：Node.js + Express + MongoDB + Redis + K8s

**适用人群**：后端开发、运维、财务风控

---

### 3. [系统集成与实现路线图](./system-integration-roadmap.md)
从设计到上线的完整实现指南，包括：
- **全系统架构总览**：官网、App、后台、区块链的完整交互图
- **用户旅程工作流**：从下载 App 到提现变现的完整 12 步流程
- **各模块间数据流**：挖矿奖励流动、Swap 流动性切换、后台审批流程
- **合约部署清单**：部署顺序、初始化步骤、合约结构建议
- **前端应用集成清单**：官网与 App 需要的开发清单
- **后端系统实现清单**：API 模块、UI 页面清单
- **测试与验证清单**：单元测试、集成测试、安全审计、上线检查
- **发布时间线**：Sepolia 测试 + Base 主网灰度 + 全量发行的 3 阶段计划

**适用人群**：项目经理、技术负责人、开发团队全员

---

## 🗂️ 文档快速导航

### 按职能查阅

**产品 & 运营**
- 代币模型：`docs/token-model.md` 第 1-8 章
- 挖矿流程：`docs/system-integration-roadmap.md` 第 2 章
- 用户管理：`docs/admin-system-design.md` 第 2.1 章

**智能合约工程师**
- 代币模型：`docs/token-model.md` 第 6-7 章
- 部署清单：`docs/system-integration-roadmap.md` 第 5 章
- 测试计划：`docs/system-integration-roadmap.md` 第 8 章

**Mobile 开发**
- App 绑定流程：`docs/token-model.md` 第 2 章
- 用户旅程：`docs/system-integration-roadmap.md` 第 2 章
- 集成清单：`docs/system-integration-roadmap.md` 第 7.2 章

**后端 & 基础设施**
- API 设计：`docs/admin-system-design.md` 第 2 章
- 系统架构：`docs/admin-system-design.md` 第 3 章
- 实现清单：`docs/system-integration-roadmap.md` 第 7.1 章

**DBA & 风控**
- 数据结构：`docs/admin-system-design.md` 第 2.1-2.5 章
- 风控规则：`docs/admin-system-design.md` 第 2.4 章
- 审计日志：`docs/admin-system-design.md` 第 2.7 章

---

## 📊 关键数据速记

### 代币经济
| 指标 | 值 |
|------|-----|
| 总供应量 | 10 亿 MM |
| 挖矿奖励池 | 5 亿 MM (50%) |
| 4 年月产量 | 1041.67 万 MM |
| 初始 Swap 池 | 50M MM + 50k USDT |
| 目标初始价格 | 1 MM = 0.001 USDT |
| LP 手续费分配 | 70% → LP, 20% → 平台, 10% → 生态 |

### 挖矿参数
| 参数 | 值 |
|------|-----|
| 最小算力 | 0.1 MH/s |
| 最大算力 | 10 MH/s |
| 难度调整周期 | 7 天 |
| 提取冷却时间 | 1 天 |
| 首月锁仓期 | 7 天 |
| 月提现限额 | 100k MM |

### 后台管理
| 指标 | 值 |
|------|-----|
| 多签配置 | 3/3 |
| API 响应目标 | < 200ms |
| 系统可用性 | 99.9% |
| 错误率 SLA | < 0.1% |

---

## 🔗 相关文件位置

```
minerhub/
├── docs/                          # 文档目录
│   ├── token-model.md            # 代币与挖矿模型
│   ├── admin-system-design.md    # 后台管理系统
│   ├── system-integration-roadmap.md  # 集成路线图
│   └── docs-index.md             # 本文件
│
├── src/                          # Web 前端代码
│   ├── components/
│   ├── lib/blockchain.ts         # 链上交互（App + 官网）
│   └── App.tsx                   # 三视图入口
│
├── app-client/                   # Mobile App 代码
│   ├── src/App.tsx               # App 首页
│   ├── app.json                  # Expo 配置
│   └── package.json              # 依赖
│
└── README.md                      # 项目主文档
```

---

## 🚀 下一步行动

根据你的角色选择对应的行动项：

### 如果你是 PM/运营
- [ ] 读完 `token-model.md` 第 1-3 章，理解代币经济
- [ ] 读完 `admin-system-design.md` 第 2 章，熟悉后台功能
- [ ] 与团队对齐上线时间线 (`system-integration-roadmap.md` 第 10 章)

### 如果你是合约工程师
- [ ] 规划合约模块结构 (`token-model.md` 第 6 章 + roadmap 第 5 章)
- [ ] 准备 Hardhat 工程与测试框架
- [ ] 预约 CertiK 审计时间

### 如果你是后端/全栈
- [ ] 启动后台 API 开发 (`admin-system-design.md` 第 2 章)
- [ ] MongoDB/Redis 前置设计
- [ ] 实现清单对齐 (`system-integration-roadmap.md` 第 7.1 章)

### 如果你是移动端
- [ ] 将 `app-client/src/App.tsx` 升级到真实链集成
- [ ] 集成 WalletConnect + Viem
- [ ] 实现清单对齐 (`system-integration-roadmap.md` 第 7.2 章)

---

## 📞 文档维护

文档最后更新于：**2026-04-04**

如发现文档与实现不符或需要补充，请在 PR 中标记相关文档文件并附上说明。

---

**祝你顺利开发！🎉**
