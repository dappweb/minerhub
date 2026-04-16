import { Apple, Download, ExternalLink, QrCode, Smartphone } from 'lucide-react';
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

function formatBytes(bytes?: number): string {
  if (!bytes) return '�?;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Download() {
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
        if (res.ok && !canceled) {
          const data = (await res.json()) as DownloadState;
          setState(data);
        }
      } catch {
        // API unavailable �?fall back to env vars silently
        const androidUrl = import.meta.env.VITE_ANDROID_DOWNLOAD_URL;
        const iosUrl = import.meta.env.VITE_IOS_DOWNLOAD_URL;
        if (!canceled) {
          setState({
            android: androidUrl && androidUrl !== '#'
              ? { available: true, downloadUrl: androidUrl }
              : { available: false },
            ios: iosUrl && iosUrl !== '#'
              ? { available: true, downloadUrl: iosUrl }
              : { available: false },
          });
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    void fetchDownloads();
    return () => { canceled = true; };
  }, [apiBase]);

  const current = selectedPlatform === 'android' ? state.android : state.ios;

  const handleDownload = (url?: string) => {
    if (url) window.open(url, '_blank');
  };

  return (
    <section id="download" className="py-24 bg-linear-to-b from-slate-900/50 to-slate-950 border-b border-slate-800/50">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-sm font-medium mb-4">
            <Download size={14} />
            立即下载
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">获取 Coin Planet 应用</h2>
          <p className="text-slate-400 text-lg">
            {loading ? '正在获取版本信息�? : '选择您的平台下载应用，开始挖矿之�?}
          </p>
        </motion.div>

        {/* Platform Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          {(['android', 'ios'] as const).map((p) => {
            const info = p === 'android' ? state.android : state.ios;
            const active = selectedPlatform === p;
            return (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 ${
                  active
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)]'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {p === 'android' ? <Smartphone size={20} /> : <Apple size={20} />}
                {p === 'android' ? 'Android' : 'iOS'}
                {info.available && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-slate-950/30' : 'bg-cyan-500/20 text-cyan-400'}`}>
                    {info.version ?? '可下�?}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Download Content */}
        <motion.div
          key={selectedPlatform}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid md:grid-cols-2 gap-8"
        >
          {/* Left: Download Info */}
          <div className="flex flex-col justify-center">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-4">
                {selectedPlatform === 'android' ? 'Android 版本' : 'iOS 版本'}
              </h3>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <div>
                    <p className="font-semibold">系统要求</p>
                    <p className="text-sm text-slate-400">
                      {selectedPlatform === 'android' ? 'Android 7.0+ (API Level 24+)' : 'iOS 16.1+'}
                    </p>
                  </div>
                </div>
                {selectedPlatform === 'android' && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold">文件大小</p>
                      <p className="text-sm text-slate-400">
                        {state.android.size ? formatBytes(state.android.size) : '�?}
                      </p>
                    </div>
                  </div>
                )}
                {current.version && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold">当前版本</p>
                      <p className="text-sm text-slate-400">v{current.version}</p>
                    </div>
                  </div>
                )}
                {current.uploadedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold">更新时间</p>
                      <p className="text-sm text-slate-400">
                        {new Date(current.uploadedAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <div>
                    <p className="font-semibold">安装方式</p>
                    <p className="text-sm text-slate-400">
                      {selectedPlatform === 'android' ? '直接 APK 下载' : 'TestFlight 公测�?App Store'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDownload(current.downloadUrl)}
                disabled={!current.available}
                className="w-full py-4 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-slate-950/50 border-t-slate-950 rounded-full animate-spin" />
                ) : current.available ? (
                  <>
                    <Download size={20} />
                    {selectedPlatform === 'android' ? '下载 APK' : '�?TestFlight 中打开'}
                  </>
                ) : (
                  <>
                    <ExternalLink size={20} />
                    暂未开�?
                  </>
                )}
              </button>

              {selectedPlatform === 'android' && current.available && (
                <p className="text-xs text-slate-500 text-center mt-4">
                  👉 安装前需开启「允许安装未知来源应用�?
                </p>
              )}
            </div>
          </div>

          {/* Right: QR Code */}
          <div className="flex items-center justify-center">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-4 text-cyan-400">
                <QrCode size={20} />
                <span className="font-semibold">扫码快速下�?/span>
              </div>

              {current.available && current.downloadUrl ? (
                <div className="mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(current.downloadUrl)}`}
                    alt={`${selectedPlatform} QR Code`}
                    className="w-48 h-48 rounded-lg mx-auto"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 mb-4 mx-auto">
                  <div className="text-center">
                    <QrCode size={40} className="text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">
                      {loading ? '加载中�? : '暂无下载'}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-sm text-slate-400">
                用手机相机扫描二维码�?br />
                直接跳转下载页面
              </p>
            </div>
          </div>
        </motion.div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 bg-slate-900/50 border border-slate-800 rounded-2xl p-8"
        >
          <h4 className="text-lg font-semibold mb-4">💡 下载遇到问题�?/h4>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-semibold text-cyan-400 mb-2">Android 用户</p>
              <ul className="text-slate-400 space-y-2">
                <li>�?确保启用了「未知来源」应用安装权�?/li>
                <li>�?如遇下载缓慢，尝试切�?Wi-Fi</li>
                <li>�?下载完成后点击安装即�?/li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-cyan-400 mb-2">iOS 用户</p>
              <ul className="text-slate-400 space-y-2">
                <li>�?需先在 TestFlight 中加入公�?/li>
                <li>�?或通过 App Store 搜索「Coin Planet�?/li>
                <li>�?需�?Apple ID 账户</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Not available banner */}
        {!loading && !state.android.available && !state.ios.available && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center"
          >
            <p className="text-yellow-500 text-sm">
              ⚠️ 应用尚未上传，请管理员通过后台 API 上传 APK 或配�?iOS 链接
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

