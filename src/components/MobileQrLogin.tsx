import React from 'react';
import QRCode from 'qrcode';

/**
 * 手机钱包扫码登录面板
 *
 * 零配置：直接把当前页面 URL 渲染成二维码。
 * 使用流程：
 *   1. 管理员在电脑浏览器打开本页面
 *   2. 用 MetaMask / Trust / OKX / imToken / TokenPocket 等移动钱包 App
 *      内置「DApp 浏览器 / 扫一扫」扫描二维码
 *   3. 手机钱包自动打开同一页面，注入 provider，点击「连接钱包」→ 完成签名
 *
 * 相比 WalletConnect 方案：
 *   - 不需要申请 WalletConnect / Reown projectId
 *   - 不受 WalletConnect 中继服务器可用性影响
 *   - 支持所有自带 DApp 浏览器的主流移动钱包
 */
export function MobileQrLogin(): React.ReactElement {
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('');
  const [pageUrl, setPageUrl] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    setPageUrl(url);
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 260,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, []);

  const handleCopy = async () => {
    if (!pageUrl) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
        <span className="text-sm font-semibold text-cyan-200">手机钱包扫码登录（零配置）</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="shrink-0 rounded-lg bg-white p-2">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="扫码登录二维码" width={160} height={160} className="block" />
          ) : (
            <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-500">生成中…</div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-slate-300 leading-relaxed">
            打开 <span className="text-cyan-300">MetaMask / Trust / OKX / imToken / TokenPocket</span> 等手机钱包 App，使用内置的
            <span className="text-cyan-300"> DApp 浏览器「扫一扫」</span> 扫描左侧二维码，即可在手机上完成 owner 钱包签名登录。
          </p>
          <p className="text-xs text-slate-500">
            无需 WalletConnect 配置，扫码后在手机钱包内点击「连接钱包」即可继续。
          </p>

          <div className="mt-2 flex flex-col gap-1">
            <div className="text-[11px] text-slate-400">或复制链接到手机钱包打开：</div>
            <div className="flex gap-2">
              <input
                readOnly
                value={pageUrl}
                className="flex-1 h-8 rounded border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-300 font-mono outline-none min-w-0"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="h-8 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-xs font-medium text-slate-950 shrink-0"
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobileQrLogin;
