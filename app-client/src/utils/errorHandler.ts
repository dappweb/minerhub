/**
 * 错误分类和处理
 * 帮助APP提供更准确的用户提示
 */

export type ErrorCategory = 
  | 'network'       // 网络问题
  | 'blockchain'    // 链交互失败
  | 'signature'     // 签名失败
  | 'validation'    // 输入验证
  | 'storage'       // 本地存储
  | 'unknown';      // 未知

export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  userMessage: string; // 用户易懂的提示
  recoverable: boolean; // 是否可重试
}

function categorizeError(error: unknown): ErrorInfo {
  const message = error instanceof Error ? error.message : String(error);

  // 网络错误
  if (message.includes('network') || message.includes('Network')) {
    return {
      category: 'network',
      message,
      userMessage: '网络连接失败，请检查网络设置',
      recoverable: true,
    };
  }

  // 签名错误
  if (message.includes('signature') || message.includes('Signature')) {
    return {
      category: 'signature',
      message,
      userMessage: '签名验证失败，请重试',
      recoverable: true,
    };
  }

  // 链交互错误
  if (
    message.includes('contract') ||
    message.includes('transaction') ||
    message.includes('revert')
  ) {
    return {
      category: 'blockchain',
      message,
      userMessage: '链上交易失败，请检查余额和gas',
      recoverable: true,
    };
  }

  // 验证错误
  if (message.includes('invalid') || message.includes('Invalid')) {
    return {
      category: 'validation',
      message,
      userMessage: '输入参数无效，请检查',
      recoverable: false,
    };
  }

  // 存储错误
  if (message.includes('storage') || message.includes('Storage')) {
    return {
      category: 'storage',
      message,
      userMessage: '本地数据存储失败',
      recoverable: true,
    };
  }

  return {
    category: 'unknown',
    message,
    userMessage: '操作失败，请稍后重试',
    recoverable: true,
  };
}

export { categorizeError };
