import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'zh' | 'en';

const dict = {
  zh: {
    'admin.section.overview': '概览',
    'admin.section.owner': 'Owner 控制台',
    'admin.section.onchain': '链上数据',
    'admin.section.tokens': '代币 & Swap',
    'admin.section.funding': '设备充值',
    'admin.section.customers': '客户列表',
    'admin.section.records': '交易记录',
    'admin.section.system': '系统设置',
    'admin.section.docs': '使用手册',

    'admin.section.overview.desc': '核心 KPI 与系统状态',
    'admin.section.owner.desc': '代币 / 收益 / 出款 / 审计',
    'admin.section.onchain.desc': '全网算力与矿工明细',
    'admin.section.tokens.desc': 'SUPER 增发与 Swap 资金池',
    'admin.section.funding.desc': '向设备钱包发放 Gas / SUPER',
    'admin.section.customers.desc': '客户合同与收益',
    'admin.section.records.desc': '充值 / 提现 / 兑换记录',
    'admin.section.system.desc': '维护 / 协议 / 客服',
    'admin.section.docs.desc': '参数配置说明 / 操作手册 / 业务功能',

    'common.language': '语言',
    'common.refresh': '刷新',
    'common.refreshing': '刷新中…',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.loading': '加载中…',
    'common.empty': '暂无记录',

    'customers.title': '客户概览',
    'customers.total': '客户总数',
    'customers.online': '在线客户',
    'customers.contractActive': '合同有效',
    'customers.expiringSoon': '即将到期 (≤30天)',
    'customers.col.wallet': '钱包',
    'customers.col.machine': '机器码',
    'customers.col.end': '合同到期',
    'customers.col.status': '状态',
    'customers.col.onlineStatus': '在线',
    'customers.col.devices': '设备',
    'customers.col.rate': '收益率',
    'customers.col.totalUsdt': '累计 USDT',
    'customers.col.actions': '操作',
    'customers.selected': '已选 {n} 位',
    'customers.selectAll': '全选',
    'customers.clearSelection': '清空',
    'customers.bulkRate': '批量收益率',
    'customers.bulkRate.apply': '应用',
    'customers.extend.label': '续期天数',
    'customers.extend.hint': '天（点行末按钮）',

    'records.title': '交易记录',
    'records.subtitle': '充值（Gas 购买）、提现（SUPER→USDT）、兑换（链上 Swap）',
    'records.recharge': '充值记录 · Gas 订单',
    'records.withdrawal': '提现记录 · SUPER→USDT / Claim',
    'records.exchange': '兑换记录 · 链上 Swap',
    'records.action.approve': '批准',
    'records.action.complete': '完成',

    'tasks.run': '立即执行调度任务',
    'tasks.hint': '扫描过期合同并触发离线告警（正常由 cron 每 15 分钟自动执行）',
  },
  en: {
    'admin.section.overview': 'Overview',
    'admin.section.owner': 'Owner Console',
    'admin.section.onchain': 'On-chain',
    'admin.section.tokens': 'Tokens & Swap',
    'admin.section.funding': 'Device Funding',
    'admin.section.customers': 'Customers',
    'admin.section.records': 'Transactions',
    'admin.section.system': 'System',
    'admin.section.docs': 'Admin Docs',

    'admin.section.overview.desc': 'Key KPIs and system status',
    'admin.section.owner.desc': 'Tokens / earnings / payouts / audit',
    'admin.section.onchain.desc': 'Network hashrate and miners',
    'admin.section.tokens.desc': 'SUPER mint and swap liquidity',
    'admin.section.funding.desc': 'Send Gas / SUPER to device wallets',
    'admin.section.customers.desc': 'Customer contracts and rewards',
    'admin.section.records.desc': 'Recharge / withdrawal / exchange',
    'admin.section.system.desc': 'Maintenance / agreements / support',
    'admin.section.docs.desc': 'Parameter guide / operation manual / business overview',

    'common.language': 'Language',
    'common.refresh': 'Refresh',
    'common.refreshing': 'Refreshing…',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading…',
    'common.empty': 'No records',

    'customers.title': 'Customer Overview',
    'customers.total': 'Total',
    'customers.online': 'Online',
    'customers.contractActive': 'Contract Active',
    'customers.expiringSoon': 'Expiring (≤30d)',
    'customers.col.wallet': 'Wallet',
    'customers.col.machine': 'Machine Code',
    'customers.col.end': 'Contract End',
    'customers.col.status': 'Status',
    'customers.col.onlineStatus': 'Online',
    'customers.col.devices': 'Devices',
    'customers.col.rate': 'Rate',
    'customers.col.totalUsdt': 'Total USDT',
    'customers.col.actions': 'Actions',
    'customers.selected': '{n} selected',
    'customers.selectAll': 'Select All',
    'customers.clearSelection': 'Clear',
    'customers.bulkRate': 'Bulk Rate',
    'customers.bulkRate.apply': 'Apply',
    'customers.extend.label': 'Extend',
    'customers.extend.hint': 'days (click row button)',

    'records.title': 'Transactions',
    'records.subtitle': 'Recharge (Gas), Withdrawal (SUPER→USDT), Exchange (on-chain Swap)',
    'records.recharge': 'Recharge · Gas Orders',
    'records.withdrawal': 'Withdrawal · SUPER→USDT / Claim',
    'records.exchange': 'Exchange · On-chain Swap',
    'records.action.approve': 'Approve',
    'records.action.complete': 'Complete',

    'tasks.run': 'Run Scheduled Tasks Now',
    'tasks.hint': 'Scan expired contracts and fire offline alerts (auto-run every 15 minutes by cron).',
  },
} as const;

export type TranslationKey = keyof typeof dict['zh'];

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'coin-planet-admin-locale';

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh' || stored === 'en') return stored;
  return window.navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const table = dict[locale] ?? dict.zh;
      let str: string = (table as Record<string, string>)[key] ?? (dict.zh as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
