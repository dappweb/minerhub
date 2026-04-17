# Coin Planet 需求对齐与差距分析

> 依据当前仓库中的前端、后台、合约与文档实现进行核对。

## 结论摘要 / Executive Summary

当前系统已经具备基础的客户端注册、链上矿工交互、SUPER/USDT 兑换、Gas 辅助和少量后台登记能力，但还没有达到你描述的“运营级闭环系统”。

English: The current system has basic client registration, on-chain miner interaction, SUPER/USDT swap, gas assistance, and limited backend records. It does not yet form the full operations-grade platform described in your requirements.

整体状态：

- 已实现：基础钱包/设备初始化、链上矿工注册、收益领取、基础 swap、部分后台 API。
- 部分实现：中英切换、收益与在线时长文案、Swap/Claim 流程、Gas 补能。
- 未实现：维护开关、合同期/月卡、小时级收益模型、客户分层与子账户、统一提现钱包池、后台完整客户总览、人工兑换闭环。

English:

- Implemented: wallet/device bootstrap, on-chain miner registration, reward claiming, basic swap, limited backend APIs.
- Partial: bilingual UI, reward/online-time messaging, swap/claim flows, gas top-up.
- Missing: maintenance flag, contract-term/month-card logic, hourly reward model, customer hierarchy and sub-accounts, withdrawal wallet pooling, full admin customer overview, manual exchange workflow.

## 1. 逐项对齐 / Requirement-by-Requirement Alignment

### 1) 系统维护开关

中文：未实现。当前没有系统级维护状态，也没有“开启后所有客户端显示维护页”的后端控制点。

English: Not implemented. There is no system-wide maintenance flag or backend control to force all clients into a maintenance screen.

现状依据：后端只暴露 users / devices / claims / gas / downloads / health 路由，没有 settings 类接口。

建议：增加系统设置表与管理接口，例如 maintenance_enabled、maintenance_message、maintenance_until。

### 2) 后台显示所有客户详情、在线情况、子账户与设备树

中文：未完成。现在只有基础用户表、设备表和收益申报表，缺少完整的客户画像、在线状态历史、离线告警、子账户层级和多设备汇总。

English: Not complete. The schema only contains basic users, devices, and claims tables; it lacks full customer profiles, online history, offline alerts, sub-account hierarchy, and multi-device aggregation.

建议：补充 customer / sub_account / device_status_history / reward_ledger 等数据模型。

### 3) 客户端只显示自己的数据

中文：部分实现。客户端已保存自身钱包、userId、deviceId，并展示个人状态、收益文案、当前设备相关信息，但没有完整的用户账本和多设备管理视图。

English: Partially implemented. The client stores its own wallet, userId, and deviceId, and shows personal status and reward-related UI, but it does not expose a full ledger or multi-device management UI.

### 4) 月卡按 30 天计算，过期无收益

中文：未实现。现有界面有“每 30 天结算一次”的文案，但实际到期时间是占位逻辑，并非真实的 30 天合同/会员到期控制。

English: Not implemented. The UI mentions 30-day settlement, but the expiry date is currently placeholder logic rather than true 30-day contract gating.

建议：建立 subscription / contract_expiry 字段，并在收益计算与客户端入口统一校验。

### 5) 客户收益按小时计算，单价可配，可批量手改

中文：未实现。当前收益逻辑仍然是链上矿池的 daily emission + hashrate 模型，不是“按小时计价、可管理端批量修正”的运营模型。

English: Not implemented. The current reward engine is still based on on-chain daily emission and hashrate, not an hourly-priced, admin-adjustable operational model.

建议：增加 reward_rate_per_hour、reward_adjustment_batch、manual_override_reason 等后台能力。

### 6) 收益兑换开关，自动兑换 / 人工兑换切换

中文：部分实现。现有系统具备领取、兑换和 Gas 辅助流程，但没有一个明确的“自动兑换开关”来切换成纯人工后台处理。

English: Partially implemented. Claim, swap, and gas-assist flows exist, but there is no explicit admin switch to disable auto-exchange and force manual back-office settlement.

### 7) 提现 USDT 统一兑换到一个或多个钱包

中文：未实现。当前更接近单用户单笔转账，没有提现池、集中归集、分钱包派发和批量结算的能力。

English: Not implemented. The current code is closer to per-user transfers, with no pooled withdrawals, centralized aggregation, or multi-wallet distribution.

### 8) SUPER / USDT 内部 swap，后台管理比例与记录

中文：部分实现。SwapRouter 已支持内部 swap、流动性和手续费收集；客户端也有兑换入口。但后台还没有完整管理 swap 价格、记录、风控和统计的工作台。

English: Partially implemented. SwapRouter supports internal swap, liquidity, and fee collection; the client has an exchange entry. However, the admin side lacks full swap pricing control, records, risk checks, and analytics.

### 9) 客户使用流程：机器码、线下付款、运营代办、协议同意、生效收益

中文：未实现闭环。当前实现覆盖的是“钱包初始化 -> 用户创建 -> 矿机注册 -> 领取收益 -> 兑换”，但没有机器码审批、线下收款确认、合同期配置、协议同意后生效这类运营流程。

English: No complete workflow yet. The current implementation covers wallet init -> user creation -> miner registration -> claim -> swap, but not machine-code approval, offline payment confirmation, configurable contract terms, or agreement acceptance gating.

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

### P0: 必须先补

1. 系统维护开关与维护页拦截。
2. 客户 / 设备 / 子账户 / 合同期 / 收益账本的数据模型。
3. 后台客户总览与离线告警。

English:

1. Maintenance flag and forced maintenance page.
2. Customer / device / sub-account / contract term / reward ledger schema.
3. Admin-wide customer overview and offline alerting.

### P1: 运营核心

1. 月卡 30 天逻辑与到期停发收益。
2. 按小时计收益与后台批量修正。
3. 自动兑换开关与人工兑换后台流程。

English:

1. 30-day month-card logic and reward stop on expiry.
2. Hourly reward accrual and admin batch corrections.
3. Auto-exchange toggle and manual settlement workflow.

### P2: 财务与流转

1. USDT 统一提现钱包池。
2. SUPER / USDT 兑换比例管理与记录审计。
3. 更完整的风控、审批和操作日志。

English:

1. Unified USDT withdrawal wallet pool.
2. SUPER / USDT ratio management and swap audit logs.
3. Better risk control, approval flow, and operation logs.

## 4. 适合后续开发的落地方向 / Practical Next Step

如果你要继续推进，我建议下一步先补一版“后台系统数据模型 + API 设计”，把以下内容一次性定下来：

- maintenance settings
- customer / sub-account / device hierarchy
- contract expiry and month-card billing
- hourly reward ledger
- manual adjustment / override log
- exchange toggle and payout wallet pool

English: The best next step is to define the admin data model and API contract in one pass, covering maintenance settings, customer/sub-account/device hierarchy, contract expiry, hourly reward ledger, manual overrides, exchange toggle, and payout wallet pool.
