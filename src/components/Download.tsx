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
        if (res.ok && !canceled) {
          const data = (await res.json()) as DownloadState;
          setState(data);
        }
      } catch {
        const androidUrl = import.meta.env.VITE_ANDROID_DOWNLOAD_URL;
        const iosUrl = import.meta.env.VITE_IOS_DOWNLOAD_URL;
        if (!canceled) {
          setState({
            android: androidUrl && androidUrl !== '#' ? { available: true, downloadUrl: androidUrl } : { available: false },
            ios: iosUrl && iosUrl !== '#' ? { available: true, downloadUrl: iosUrl } : { available: false },
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

  const resolveUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${apiBase}${url}`;
  };

  const handleDownload = (url?: string) => {
    const full = resolveUrl(url);
    if (full) window.open(full, '_blank');
  };

  return (
    <section id="download" className="py-24 bg-linear-to-b from-slate-900/50 to-slate-950 border-b border-slate-800/50">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-sm font-medium mb-4">
            <Download size={14} />
            Download App
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Get Coin Planet</h2>
          <p className="text-slate-400 text-lg">{loading ? 'Loading...' : 'Choose your platform to start mining'}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid grid-cols-2 gap-4 mb-8">
          {(['android', 'ios'] as const).map((p) => {
            const info = p === 'android' ? state.android : state.ios;
            const active = selectedPlatform === p;
            return (
              <button key={p} onClick={() => setSelectedPlatform(p)} className={`py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 ${active ? 'bg-cyan-500 text-slate-950 shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)]' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                {p === 'android' ? <Smartphone size={20} /> : <Apple size={20} />}
                {p === 'android' ? 'Android' : 'iOS'}
                {info.available && <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-slate-950/30' : 'bg-cyan-500/20 text-cyan-400'}`}>{info.version || 'ready'}</span>}
              </button>
            );
          })}
        </motion.div>

        <motion.div key={selectedPlatform} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid md:grid-cols-2 gap-8">
          <div className="flex flex-col justify-center">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-4">{selectedPlatform === 'android' ? 'Android' : 'iOS'}</h3>
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <div><p className="font-semibold">System</p><p className="text-sm text-slate-400">{selectedPlatform === 'android' ? 'Android 7.0+ (API 24+)' : 'iOS 16.1+'}</p></div>
                </div>
                {selectedPlatform === 'android' && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div><p className="font-semibold">Size</p><p className="text-sm text-slate-400">{state.android.size ? formatBytes(state.android.size) : '--'}</p></div>
                  </div>
                )}
                {current.version && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div><p className="font-semibold">Version</p><p className="text-sm text-slate-400">v{current.version}</p></div>
                  </div>
                )}
                {current.uploadedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <div><p className="font-semibold">Updated</p><p className="text-sm text-slate-400">{new Date(current.uploadedAt).toLocaleDateString('zh-CN')}</p></div>
                  </div>
                )}
              </div>
              <button onClick={() => handleDownload(current.downloadUrl)} disabled={!current.available} className="w-full py-4 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? (<span className="w-5 h-5 border-2 border-slate-950/50 border-t-slate-950 rounded-full animate-spin" />) : current.available ? (<><Download size={20} />{selectedPlatform === 'android' ? 'Download APK' : 'Open TestFlight'}</>) : (<><ExternalLink size={20} />Not Available</>)}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-4 text-cyan-400"><QrCode size={20} /><span className="font-semibold">Scan to Download</span></div>
              {current.available && current.downloadUrl ? (
                <div className="mb-4"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(resolveUrl(current.downloadUrl))}`} alt={`${selectedPlatform} QR`} className="w-48 h-48 rounded-lg mx-auto" /></div>
              ) : (
                <div className="w-48 h-48 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 mb-4 mx-auto"><div className="text-center"><QrCode size={40} className="text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-400">{loading ? 'Loading...' : 'No download'}</p></div></div>
              )}
              <p className="text-sm text-slate-400">Scan with your phone camera</p>
            </div>
          </div>
        </motion.div>

        {!loading && !state.android.available && !state.ios.available && (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
            <p className="text-yellow-500 text-sm">App not uploaded yet. Admin can upload APK via API.</p>
          </motion.div>
        )}
      </div>
    </section>
  );
}