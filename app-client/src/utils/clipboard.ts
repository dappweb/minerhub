import { Platform } from 'react-native';

/**
 * Copy text to system clipboard.
 * - Native: uses expo-clipboard (loaded lazily so the web bundle never imports it,
 *   avoiding the broken "./web/ClipboardModule" resolution in expo-clipboard@7).
 * - Web: uses navigator.clipboard with a document.execCommand fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (Platform.OS !== 'web') {
    try {
      const mod = await import('expo-clipboard');
      await mod.setStringAsync(text);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const nav: any = (globalThis as any).navigator;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy fallback
  }

  try {
    const doc: any = (globalThis as any).document;
    if (!doc) return false;
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    doc.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = doc.execCommand('copy');
    doc.body.removeChild(ta);
    return Boolean(ok);
  } catch {
    return false;
  }
}
