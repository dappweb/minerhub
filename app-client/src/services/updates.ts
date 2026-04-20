import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

type Lang = 'en' | 'zh';

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'available'
  | 'ready'
  | 'up-to-date'
  | 'disabled'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  error?: string;
  isAvailable: boolean;
  isReady: boolean;
  manifest?: Updates.Manifest | null;
}

const MESSAGES: Record<
  Lang,
  {
    title: string;
    message: string;
    restart: string;
    later: string;
    checking: string;
    downloading: string;
    upToDate: string;
    failed: string;
  }
> = {
  zh: {
    title: '发现新版本',
    message: '已下载最新功能和修复，立即重启应用？',
    restart: '立即重启',
    later: '稍后',
    checking: '正在检查更新...',
    downloading: '正在下载更新...',
    upToDate: '已是最新版本',
    failed: '检查更新失败',
  },
  en: {
    title: 'New Version Available',
    message: 'The latest features and fixes have been downloaded. Restart now?',
    restart: 'Restart',
    later: 'Later',
    checking: 'Checking for updates...',
    downloading: 'Downloading update...',
    upToDate: 'Up to date',
    failed: 'Update check failed',
  },
};

/**
 * 静默检查并下载 OTA 更新。下载完成后调用 onReady 回调（通常用于弹窗提醒）。
 */
export async function checkForUpdateSilently(): Promise<{
  available: boolean;
  manifest?: Updates.Manifest | null;
  error?: string;
}> {
  if (!Updates.isEnabled || __DEV__) {
    return { available: false };
  }

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      return { available: false };
    }

    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) {
      return { available: false };
    }

    return { available: true, manifest: fetched.manifest };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 应用新版本 - 调起重载。调用后 App 会立即重启并加载新 bundle。
 */
export async function applyUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // 重启失败（极少数情况）只能提示用户手动重开
  }
}

/**
 * 弹窗提示用户更新。可从任意时机调用。
 */
export function promptUpdateReady(lang: Lang = 'zh'): void {
  const t = MESSAGES[lang];
  Alert.alert(t.title, t.message, [
    { text: t.later, style: 'cancel' },
    {
      text: t.restart,
      style: 'default',
      onPress: () => {
        void applyUpdate();
      },
    },
  ]);
}

/**
 * App 启动时使用：后台静默下载 OTA，就绪后弹窗请求重启。
 * 失败不阻塞主流程。
 */
export function useAutoUpdate(lang: Lang = 'zh'): UpdateState {
  const [state, setState] = useState<UpdateState>({
    status: Updates.isEnabled ? 'idle' : 'disabled',
    isAvailable: false,
    isReady: false,
  });

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;

    let cancelled = false;
    const run = async () => {
      setState((s) => ({ ...s, status: 'checking' }));
      const result = await checkForUpdateSilently();
      if (cancelled) return;

      if (result.error) {
        setState({
          status: 'error',
          error: result.error,
          isAvailable: false,
          isReady: false,
        });
        return;
      }

      if (!result.available) {
        setState({ status: 'up-to-date', isAvailable: false, isReady: false });
        return;
      }

      setState({
        status: 'ready',
        isAvailable: true,
        isReady: true,
        manifest: result.manifest,
      });

      promptUpdateReady(lang);
    };

    void run();
    return () => {
      cancelled = true;
    };
    // intentionally depend only on lang for initial run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

/**
 * 用户在"设置/个人中心"手动点击「检查更新」时调用。
 * 返回是否需要重启。
 */
export async function manualCheckForUpdate(lang: Lang = 'zh'): Promise<void> {
  const t = MESSAGES[lang];

  if (!Updates.isEnabled || __DEV__) {
    Alert.alert(t.title, t.upToDate);
    return;
  }

  const result = await checkForUpdateSilently();
  if (result.error) {
    Alert.alert(t.failed, result.error);
    return;
  }

  if (!result.available) {
    Alert.alert(t.title, t.upToDate);
    return;
  }

  promptUpdateReady(lang);
}

export const currentUpdateInfo = {
  runtimeVersion: Updates.runtimeVersion,
  updateId: Updates.updateId,
  channel: Updates.channel,
  createdAt: Updates.createdAt,
  isEmbeddedLaunch: Updates.isEmbeddedLaunch,
};
