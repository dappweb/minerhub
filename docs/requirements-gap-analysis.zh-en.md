# Coin Planet 需求对齐与差距分析

> 依据当前仓库中的前端、后台、合约与文档实现进行核对。

## 结论摘要 / Executive Summary

当前系统已具备运营闭环的核心能力：维护开关、客户总览与设备/子账户关系、合同期与月卡收益门控、小时收益账本、自动/人工兑换切换、统一提现钱包池、Swap 比率配置与审计记录。

English: The platform now includes core operations-grade controls: maintenance gating, customer/device/sub-account views, contract/month-card gating, hourly reward ledger, auto/manual exchange switching, pooled payout wallet flow, and swap ratio/audit records.

整体状态：

- 已实现：基础钱包/设备初始化、链上矿工注册、收益领取、基础 swap、维护开关、合同期/月卡、小时收益账本、客户分层与子账户、统一提现钱包池、人工兑换闭环接口。
- 部分实现：管理后台 UI 仍以链上统计为主，部分运营接口暂以 API 方式提供。
- 待持续优化：风控策略、审批细粒度、可视化报表。

English:

- Implemented: wallet/device bootstrap, on-chain miner registration, reward claiming, basic swap, maintenance controls, contract/month-card gating, hourly reward ledger, customer hierarchy/sub-accounts, pooled payout flow, and manual exchange APIs.
- Partial: admin UI still focuses on on-chain metrics; part of operations is currently API-first.
- Ongoing optimization: risk control depth, approval granularity, and analytics UI.

## 1. 逐项对齐 / Requirement-by-Requirement Alignment

### 1) 系统维护开关

中文：已实现。`system_settings` 提供维护开关与中英维护文案，Web/App 在维护模式下进入维护页。

English: Implemented. `system_settings` now drives maintenance mode and bilingual messages; Web/App can be gated by maintenance status.

### 2) 后台显示所有客户详情、在线情况、子账户与设备树

中文：已实现（API 层）。`customer_profiles / sub_accounts / device_status_history / reward_ledger` 已接入后台接口并支持汇总查询。

English: Implemented at API layer. `customer_profiles / sub_accounts / device_status_history / reward_ledger` are integrated and queryable.

### 3) 客户端只显示自己的数据

中文：已实现。客户端按钱包签名与 userId 获取并渲染个人数据，后端明细接口按用户维度隔离。

English: Implemented. Client data access is scoped to signed wallet and userId; backend details are user-scoped.

### 4) 月卡按 30 天计算，过期无收益

中文：已实现。`monthly_card_days` 与 `contract_end_at` 已进入收益路径校验；合同过期后停止累计与领取。

English: Implemented. `monthly_card_days` and `contract_end_at` now gate accrual and claim logic; expired contracts stop rewards.

### 5) 客户收益按小时计算，单价可配，可批量手改

中文：已实现。设备心跳触发小时收益累积，单价来自系统/用户配置；新增批量修正接口 `POST /api/operations/rewards/batch`。

English: Implemented. Device heartbeat accrues hourly rewards with system/user-configurable rates; batch adjustment endpoint is available at `POST /api/operations/rewards/batch`.

### 6) 收益兑换开关，自动兑换 / 人工兑换切换

中文：已实现。全局开关 `exchange_auto_enabled` 与用户级开关共同决定兑换请求进入自动或人工流程；新增 `POST /api/claims/exchange-request`。

English: Implemented. Global and per-user exchange toggles determine auto/manual mode; exchange request API is `POST /api/claims/exchange-request`.

### 7) 提现 USDT 统一兑换到一个或多个钱包

中文：已实现（运营 API 层）。新增提现批次与批次明细：按已审批兑换单归集到统一钱包池并完成批量结算。

English: Implemented at operations API layer. Payout batches aggregate approved exchange orders into pooled wallet settlements.

### 8) SUPER / USDT 内部 swap，后台管理比例与记录

中文：已实现（API 层）。新增 swap 比率配置写入、价格历史与交易日志接口，支持后台审计。

English: Implemented at API layer with swap ratio update, price history, and trade log endpoints for admin audit.

### 9) 客户使用流程：机器码、线下付款、运营代办、协议同意、生效收益

中文：已具备闭环主链路。客户激活接口已支持机器码、合同期、协议确认时间、收益生效状态；运营可通过后台接口代办激活与修正。

English: Core operational workflow is now in place. Customer activation supports machine code, contract term, agreement timestamp, and reward activation states.

## 2. 当前仓库里已经存在的能力 / What Already Exists

- 客户端有中英切换、身份初始化、矿机注册、领取收益、swap、Gas 补能。
- 后端有 users / devices / claims / gas 基础路由。
- 合约有 MiningPool、SwapRouter、SUPER、USDT_Mock。
- 后台页面已有概念性 Dashboard，但主要读取链上统计，尚未覆盖运营管理闭环。

English:

- The client already has bilingual UI, identity bootstrap, miner registration, claim, swap, and gas assistance.
- The backend has basic users/devices/claims/gas routes.
- Contracts include MiningPool, SwapRouter, SUPER, and USDT_Mock.
- The admin page exists as a concept dashboard, but it mostly reads on-chain stats and does not yet cover the full operational workflow.

## 3. 建议优先级 / Recommended Priority

### P0: 已落地，建议重点验收

1. 系统维护开关与维护页拦截。
2. 客户 / 设备 / 子账户 / 合同期 / 收益账本的数据模型与接口。
3. 后台客户总览与在线离线追踪。

English:

1. Maintenance flag and forced maintenance page.
2. Customer / device / sub-account / contract term / reward ledger schema.
3. Admin-wide customer overview and offline alerting.

### P1: 已落地，建议补齐 UI 操作面板

1. 月卡 30 天逻辑与到期停发收益。
2. 按小时计收益与后台批量修正。
3. 自动兑换开关与人工兑换后台流程。

English:

1. 30-day month-card logic and reward stop on expiry.
2. Hourly reward accrual and admin batch corrections.
3. Auto-exchange toggle and manual settlement workflow.

### P2: 持续增强

1. USDT 统一提现钱包池（批次化操作与回执追踪）。
2. SUPER / USDT 兑换比例管理与记录审计。
3. 更完整的风控规则、审批粒度和可视化报表。

English:

1. Unified USDT withdrawal wallet pool.
2. SUPER / USDT ratio management and swap audit logs.
3. Better risk control, approval flow, and operation logs.

## 4. 适合后续开发的落地方向 / Practical Next Step

如果继续推进，建议下一步是补齐管理端 UI，对已落地 API 做可视化操作和验收脚本：

- exchange orders + payout batches 的后台审批界面
- rewards batch 调整模板导入
- swap 比率变更与交易日志看板
- 端到端验收脚本（9 条需求逐项自动校验）

English: The best next step is to define the admin data model and API contract in one pass, covering maintenance settings, customer/sub-account/device hierarchy, contract expiry, hourly reward ledger, manual overrides, exchange toggle, and payout wallet pool.
