import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type TransactionState = 'idle' | 'pending' | 'confirming' | 'confirmed' | 'failed';

export interface Transaction {
  id: string;
  type: 'mine' | 'claim' | 'swap';
  state: TransactionState;
  hash: string;
  amount?: string;
  timestamp: number;
  error?: string;
  retryCount: number;
}

const STORAGE_KEY = 'coinplanet.transactions';
const MAX_RETRIES = 3;

/**
 * 交易状态管理Hook
 * 负责：
 * 1. 交易生命周期管理
 * 2. AsyncStorage持久化
 * 3. 断网恢复和重试机制
 * 4. 历史记录
 */
export function useTransactionManager() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：从存储恢复未完成的交易
  useEffect(() => {
    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Transaction[];
          setTransactions(parsed);
        }
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, []);

  // 持久化交易列表
  const saveTransactions = useCallback(
    async (updated: Transaction[]) => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setTransactions(updated);
      } catch (error) {
        console.error('Failed to save transactions:', error);
      }
    },
    []
  );

  // 创建新交易
  const createTransaction = useCallback(
    (type: 'mine' | 'claim' | 'swap', amount?: string): Transaction => {
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        state: 'pending',
        hash: '',
        amount,
        timestamp: Date.now(),
        retryCount: 0,
      };
      const updated = [...transactions, tx];
      void saveTransactions(updated);
      return tx;
    },
    [transactions, saveTransactions]
  );

  // 更新交易状态
  const updateTransaction = useCallback(
    (id: string, updates: Partial<Transaction>) => {
      const updated = transactions.map((tx) =>
        tx.id === id ? { ...tx, ...updates } : tx
      );
      void saveTransactions(updated);
    },
    [transactions, saveTransactions]
  );

  // 标记交易为进行中
  const markPending = useCallback(
    (id: string, hash: string) => {
      updateTransaction(id, { state: 'pending', hash });
    },
    [updateTransaction]
  );

  // 标记交易为确认中
  const markConfirming = useCallback(
    (id: string) => {
      updateTransaction(id, { state: 'confirming' });
    },
    [updateTransaction]
  );

  // 标记交易为已确认
  const markConfirmed = useCallback(
    (id: string) => {
      updateTransaction(id, { state: 'confirmed' });
    },
    [updateTransaction]
  );

  // 标记交易为失败（可重试）
  const markFailed = useCallback(
    (id: string, error: string) => {
      const tx = transactions.find((t) => t.id === id);
      if (!tx) return;

      const newRetryCount = tx.retryCount + 1;
      const shouldFail = newRetryCount >= MAX_RETRIES;

      updateTransaction(id, {
        state: shouldFail ? 'failed' : 'pending',
        error,
        retryCount: newRetryCount,
      });
    },
    [transactions, updateTransaction]
  );

  // 获取需要重试的交易
  const getRetriableTransactions = useCallback(() => {
    return transactions.filter(
      (tx) => tx.state === 'pending' && tx.retryCount < MAX_RETRIES
    );
  }, [transactions]);

  // 获取未完成的交易
  const getPendingTransactions = useCallback(() => {
    return transactions.filter((tx) => tx.state !== 'confirmed' && tx.state !== 'failed');
  }, [transactions]);

  // 清理已完成的交易（保留最近50条）
  const cleanup = useCallback(async () => {
    const completed = transactions.filter(
      (tx) => tx.state === 'confirmed' || (tx.state === 'failed' && tx.retryCount >= MAX_RETRIES)
    );
    if (completed.length > 50) {
      const removed = completed.slice(0, completed.length - 50);
      const updated = transactions.filter((tx) => !removed.includes(tx));
      await saveTransactions(updated);
    }
  }, [transactions, saveTransactions]);

  return {
    transactions,
    isLoading,
    createTransaction,
    updateTransaction,
    markPending,
    markConfirming,
    markConfirmed,
    markFailed,
    getRetriableTransactions,
    getPendingTransactions,
    cleanup,
  };
}
