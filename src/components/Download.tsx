import { Clock3, Download, ExternalLink, HardDrive, QrCode, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import * as QRCode from 'qrcode';
import React from 'react';

const DEFAULT_API_BASE_URL = 'https://api.coinplanets.net';

function resolveApiBaseUrl(): string {
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envBase) {
    return envBase.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const { origin, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return origin.replace(/\/+$/, '');
    }
  }

  return DEFAULT_API_BASE_URL;
}

interface DownloadInfo {
  available: boolean;
  version?: string;
  size?: number;
  uploadedAt?: string;
  downloadUrl?: string;
}

interface DownloadState {
  android: DownloadInfo;
}

function buildFallbackState(): DownloadState {
  const androidEnvUrl = import.meta.env.VITE_ANDROID_DOWNLOAD_URL;
  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Keep a deterministic local fallback so static Pages deployments can serve
  // APK directly without requiring backend upload metadata first.
  const androidUrl = androidEnvUrl && androidEnvUrl !== '#' ? androidEnvUrl : isLocalDev ? '/downloads/app-release.apk' : '/api/downloads/android';

  return {
    android: androidUrl ? { available: true, downloadUrl: androidUrl } : { available: false },
  };
}

function mergeWithFallback(remote: DownloadState | null): DownloadState {
  const fallbackState = buildFallbackState();
  if (!remote) return fallbackState;

  return {
    android:
      remote.android?.available || remote.android?.downloadUrl
        ? remote.android
        : fallbackState.android,
  };
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '--';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getQrTitle(): string {
  return '扫码下载';
}

function getQrHint(): string {
  return '使用手机扫码即可直接下载安装。';
}

function getInstallHint(): string {
  return '安装后请先完成身份同步，再用机器码联系管理员开通月卡，最后点击“矿机设置”开始累计收益。';
}

export default function DownloadSection() {
  const [state, setState] = React.useState<DownloadState>({
    android: { available: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('');
  const apiBase = React.useMemo(() => resolveApiBaseUrl(), []);

  React.useEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);

    const fetchDownloads = async () => {
      try {
        const res = await fetch(`${apiBase}/api/downloads`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as DownloadState;
          if (!canceled) {
            setState(mergeWithFallback(data));
          }
          return;
        }

        if (!canceled) {
          setState(mergeWithFallback(null));
        }
      } catch {
        if (!canceled) {
          setState(mergeWithFallback(null));
        }
      } finally {
        window.clearTimeout(timeout);
        if (!canceled) setLoading(false);
      }
    };
    void fetchDownloads();
    return () => {
      canceled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [apiBase]);

  const current = state.android;
  const resolveUrl = React.useCallback((url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${apiBase}${url}`;
  }, [apiBase]);
  const resolvedDownloadUrl = React.useMemo(() => resolveUrl(current.downloadUrl), [apiBase, current.downloadUrl]);

  React.useEffect(() => {
    let canceled = false;
    const envQrCode = (import.meta.env.VITE_ANDROID_QR_CODE as string | undefined)?.trim();

    const createQr = async () => {
      if (!current.available || !resolvedDownloadUrl) {
        setQrDataUrl('');
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(resolvedDownloadUrl, {
          margin: 1,
          width: 240,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#020617ff',
            light: '#ffffffff',
          },
        });
        if (!canceled) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (!canceled) {
          setQrDataUrl(envQrCode || '');
        }
      }
    };

    void createQr();
    return () => {
      canceled = true;
    };
  }, [current.available, resolvedDownloadUrl]);

  const handleDownload = (url?: string) => {
    const full = resolveUrl(url);
    if (full) window.open(full, '_blank');
  };

  const platformMeta = {
    android: {
      name: 'Android',
      subtitle: '安卓 APK 直接安装',
      requirement: 'Android 7.0+ (API 24+)',
      cta: '立即下载 APK',
      icon: Smartphone,
    },
  } as const;

  const selectedMeta = platformMeta.android;
  const SelectedIcon = selectedMeta.icon;
  const faqs = [
    {
      q: '推荐人钱包有什么用？',
      a: '首次注册需要绑定推荐人钱包，用于完成账户关系建立和团队统计。',
    },
    {
      q: '机器码是什么？',
      a: '机器码用于把你的手机设备和开通服务关联起来，提交给客服后即可进入激活流程。',
    },
    {
      q: '为什么会提示 Gas？',
      a: '链上激活和提现需要少量网络费，余额不足时 App 会引导你申请支持。',
    },
  ];

  return (
    <section id="download" className="relative overflow-hidden border-b border-slate-800/70 bg-[#020b22] py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-12 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-6 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.18),transparent_38%),radial-gradient(circle_at_80%_90%,rgba(14,116,255,0.18),transparent_34%)]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-300">
            <Download size={14} />
            APP 下载
          </div>
          <h2 className="mb-3 text-4xl font-bold tracking-tight text-white md:text-5xl">下载 Coin Planet App</h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-300/90">
            {loading ? '正在读取最新发布版本...' : '下载最新版 App，按“身份同步 → 提交机器码开通 → 激活设备 → 保持在线”完成准备并开始累计收益。'}
          </p>
        </motion.div>

        <motion.div
          key="android"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid gap-6 md:grid-cols-[1.35fr_1fr]"
        >
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-7 shadow-[0_18px_60px_-35px_rgba(14,165,233,0.8)] backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/15 p-2 text-cyan-300">
                  <SelectedIcon size={18} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{selectedMeta.name}</h3>
                  <p className="text-sm text-slate-300">{selectedMeta.subtitle}</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${current.available ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {current.available ? '可下载' : '待发布'}
              </span>
            </div>

            <div className="mb-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  <ShieldCheck size={14} />
                  安装要求
                </p>
                <p className="text-sm font-medium text-slate-100">{selectedMeta.requirement}</p>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  <HardDrive size={14} />
                  安装包大小
                </p>
                <p className="text-sm font-medium text-slate-100">{formatBytes(state.android.size)}</p>
              </div>
            </div>

            <div className="mb-7 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-100">发布通道</p>
                    <p className="text-sm text-slate-400">线上 APK 直装包</p>
                  </div>
                </div>
                {current.version && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-100">版本号</p>
                      <p className="text-sm text-slate-400">v{current.version}</p>
                    </div>
                  </div>
                )}
                {current.uploadedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-100">更新时间</p>
                      <p className="text-sm text-slate-400">{new Date(current.uploadedAt).toLocaleDateString('zh-CN')}</p>
                    </div>
                  </div>
                )}
              </div>

            <button
              onClick={() => handleDownload(current.downloadUrl)}
              disabled={!current.available}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-4 font-bold text-slate-950 shadow-[0_0_22px_-8px_rgba(6,182,212,0.8)] transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950/50 border-t-slate-950" />
              ) : current.available ? (
                <>
                  <Download size={20} />
                  {selectedMeta.cta}
                </>
              ) : (
                <>
                  <ExternalLink size={20} />
                  暂不可用
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock3 size={13} />
              <span>{current.uploadedAt ? `最近更新 ${new Date(current.uploadedAt).toLocaleString('zh-CN')}` : '发布后这里会显示更新时间。'}</span>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              官方下载地址：<span className="break-all">{resolvedDownloadUrl || `${apiBase}/api/downloads/android`}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 text-center backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-center gap-2 text-cyan-300">
              <QrCode size={20} />
              <span className="font-semibold">{getQrTitle()}</span>
            </div>

            {current.available && resolvedDownloadUrl ? (
              <div className="mx-auto mb-4 w-fit rounded-2xl border border-cyan-400/30 bg-white/95 p-3 shadow-[0_12px_45px_-25px_rgba(255,255,255,0.9)]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Android App 下载二维码"
                    className="h-52 w-52 rounded-lg"
                  />
                ) : (
                  <div className="flex h-52 w-52 items-center justify-center rounded-lg text-sm text-slate-500">生成中...</div>
                )}
              </div>
            ) : (
              <div className="mx-auto mb-4 flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/70">
                <div className="text-center">
                  <QrCode size={40} className="mx-auto mb-2 text-slate-500" />
                  <p className="text-sm text-slate-300">{loading ? '读取中...' : current.available ? '二维码生成中...' : '暂无下载'}</p>
                </div>
              </div>
            )}

            <p className="mb-3 text-sm text-slate-300">{getQrHint()}</p>

            <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-3 text-left">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                <Sparkles size={14} />
                安装提示
              </p>
              <p className="text-sm text-slate-300">{getInstallHint()}</p>
            </div>
          </div>
        </motion.div>

        {!loading && !state.android.available && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-7 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4 text-center"
          >
            <p className="text-sm text-amber-300">当前还没有可下载的安装包，管理员上传发布后这里会自动更新。</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 grid gap-3 sm:grid-cols-3"
        >
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 text-center text-sm text-slate-300">
            <p className="mb-1 text-xs uppercase tracking-wide text-cyan-300">Security</p>
            <p>正式签名安装包</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 text-center text-sm text-slate-300">
            <p className="mb-1 text-xs uppercase tracking-wide text-cyan-300">Network</p>
            <p>连接线上下载分发接口</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 text-center text-sm text-slate-300">
            <p className="mb-1 text-xs uppercase tracking-wide text-cyan-300">Experience</p>
            <p>手机端收益与团队实时同步</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 rounded-2xl border border-slate-700/70 bg-slate-900/60 p-6 backdrop-blur-sm"
        >
          <div className="mb-5">
            <h3 className="text-2xl font-bold text-white">下载前常见问题</h3>
            <p className="mt-2 text-sm text-slate-400">把新用户最常问的几个问题前置，减少下载后反复找客服确认。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-100">{item.q}</p>
                <p className="text-sm leading-6 text-slate-400">{item.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
