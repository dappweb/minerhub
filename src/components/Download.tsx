import { Apple, Clock3, Download, ExternalLink, HardDrive, QrCode, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

interface DownloadInfo {
  available: boolean;
  version?: string;
  size?: number;
  uploadedAt?: string;
  downloadUrl?: string;
}

interface DownloadState {
  android: DownloadInfo;
  ios: DownloadInfo;
}

function buildFallbackState(): DownloadState {
  const androidEnvUrl = import.meta.env.VITE_ANDROID_DOWNLOAD_URL;
  const iosEnvUrl = import.meta.env.VITE_IOS_DOWNLOAD_URL;

  // Keep a deterministic local fallback so static Pages deployments can serve
  // APK directly without requiring backend upload metadata first.
  const androidUrl = androidEnvUrl && androidEnvUrl !== '#' ? androidEnvUrl : '/downloads/app-release.apk';
  const iosUrl = iosEnvUrl && iosEnvUrl !== '#' ? iosEnvUrl : '';

  return {
    android: androidUrl ? { available: true, downloadUrl: androidUrl } : { available: false },
    ios: iosUrl ? { available: true, downloadUrl: iosUrl } : { available: false },
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
    ios:
      remote.ios?.available || remote.ios?.downloadUrl
        ? remote.ios
        : fallbackState.ios,
  };
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '--';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DownloadSection() {
  const [selectedPlatform, setSelectedPlatform] = React.useState<'android' | 'ios'>('android');
  const [state, setState] = React.useState<DownloadState>({
    android: { available: false },
    ios: { available: false },
  });
  const [loading, setLoading] = React.useState(true);
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';

  React.useEffect(() => {
    let canceled = false;
    const fetchDownloads = async () => {
      try {
        const res = await fetch(`${apiBase}/api/downloads`);
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
        if (!canceled) setLoading(false);
      }
    };
    void fetchDownloads();
    return () => { canceled = true; };
  }, [apiBase]);

  const current = selectedPlatform === 'android' ? state.android : state.ios;

  const resolveUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${apiBase}${url}`;
  };

  const handleDownload = (url?: string) => {
    const full = resolveUrl(url);
    if (full) window.open(full, '_blank');
  };

  const platformMeta = {
    android: {
      name: 'Android',
      subtitle: 'APK direct install',
      requirement: 'Android 7.0+ (API 24+)',
      cta: 'Download APK',
      icon: Smartphone,
    },
    ios: {
      name: 'iOS',
      subtitle: 'TestFlight release',
      requirement: 'iOS 16.1+',
      cta: 'Open TestFlight',
      icon: Apple,
    },
  } as const;

  const selectedMeta = platformMeta[selectedPlatform];
  const SelectedIcon = selectedMeta.icon;

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
            Download App
          </div>
          <h2 className="mb-3 text-4xl font-bold tracking-tight text-white md:text-5xl">Get Coin Planet</h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-300/90">
            {loading ? 'Loading release channels...' : 'Install the latest app build and start mining in less than one minute.'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 grid grid-cols-2 gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/65 p-2 backdrop-blur"
        >
          {(['android', 'ios'] as const).map((p) => {
            const info = p === 'android' ? state.android : state.ios;
            const active = selectedPlatform === p;
            const meta = platformMeta[p];
            const Icon = meta.icon;

            return (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`group rounded-xl px-4 py-3 transition-all ${
                  active
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_28px_-8px_rgba(6,182,212,0.65)]'
                    : 'bg-slate-800/80 text-slate-100 hover:bg-slate-700/90'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-left">
                    <Icon size={18} />
                    <div>
                      <p className="text-base font-semibold">{meta.name}</p>
                      <p className={`text-xs ${active ? 'text-slate-900/80' : 'text-slate-300/80'}`}>{meta.subtitle}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      info.available
                        ? active
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-emerald-500/20 text-emerald-300'
                        : active
                          ? 'bg-slate-950/20 text-slate-900'
                          : 'bg-slate-600/30 text-slate-300'
                    }`}
                  >
                    {info.available ? (info.version ? `v${info.version}` : 'ready') : 'pending'}
                  </span>
                </div>
              </button>
            );
          })}
        </motion.div>

        <motion.div
          key={selectedPlatform}
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
                {current.available ? 'Live channel' : 'Pending release'}
              </span>
            </div>

            <div className="mb-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  <ShieldCheck size={14} />
                  Compatibility
                </p>
                <p className="text-sm font-medium text-slate-100">{selectedMeta.requirement}</p>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  <HardDrive size={14} />
                  Package size
                </p>
                <p className="text-sm font-medium text-slate-100">{selectedPlatform === 'android' ? formatBytes(state.android.size) : '--'}</p>
              </div>
            </div>

            <div className="mb-7 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-100">Release track</p>
                    <p className="text-sm text-slate-400">{selectedPlatform === 'android' ? 'Public APK package' : 'Apple TestFlight channel'}</p>
                  </div>
                </div>
                {current.version && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-100">Version</p>
                      <p className="text-sm text-slate-400">v{current.version}</p>
                    </div>
                  </div>
                )}
                {current.uploadedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-100">Updated</p>
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
                  Not Available
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock3 size={13} />
              <span>{current.uploadedAt ? `Last updated ${new Date(current.uploadedAt).toLocaleString('zh-CN')}` : 'Release timestamp will appear after upload.'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 text-center backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-center gap-2 text-cyan-300">
              <QrCode size={20} />
              <span className="font-semibold">Scan to Download</span>
            </div>

            {current.available && current.downloadUrl ? (
              <div className="mx-auto mb-4 w-fit rounded-2xl border border-cyan-400/30 bg-white/95 p-3 shadow-[0_12px_45px_-25px_rgba(255,255,255,0.9)]">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(resolveUrl(current.downloadUrl))}`}
                  alt={`${selectedPlatform} QR`}
                  className="h-52 w-52 rounded-lg"
                />
              </div>
            ) : (
              <div className="mx-auto mb-4 flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/70">
                <div className="text-center">
                  <QrCode size={40} className="mx-auto mb-2 text-slate-500" />
                  <p className="text-sm text-slate-300">{loading ? 'Loading...' : 'No download'}</p>
                </div>
              </div>
            )}

            <p className="mb-3 text-sm text-slate-300">Scan with your phone camera and install directly.</p>

            <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-3 text-left">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                <Sparkles size={14} />
                Install tips
              </p>
              <p className="text-sm text-slate-300">Enable network access and keep enough storage space before installation.</p>
            </div>
          </div>
        </motion.div>

        {!loading && !state.android.available && !state.ios.available && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-7 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4 text-center"
          >
            <p className="text-sm text-amber-300">App package has not been uploaded yet. Admin can publish the build from API backend.</p>
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
            <p>Signed release package</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 text-center text-sm text-slate-300">
            <p className="mb-1 text-xs uppercase tracking-wide text-cyan-300">Network</p>
            <p>Optimized for global nodes</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 text-center text-sm text-slate-300">
            <p className="mb-1 text-xs uppercase tracking-wide text-cyan-300">Rewards</p>
            <p>Real-time mining sync</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}