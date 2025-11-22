import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Locale = 'en-US' | 'zh-CN' | 'ja-JP' | 'ko-KR';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

// Simple translation dictionary
const translations: Record<Locale, Record<string, string>> = {
  'en-US': {
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.retry': 'Retry',
    'common.undo': 'Undo',
    'agent.thinking': 'Thinking...',
    'agent.executing': 'Executing...',
    'agent.completed': 'Completed',
    'agent.failed': 'Failed',
  },
  'zh-CN': {
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.retry': '重试',
    'common.undo': '撤销',
    'agent.thinking': '思考中...',
    'agent.executing': '执行中...',
    'agent.completed': '已完成',
    'agent.failed': '失败',
  },
  'ja-JP': {
    'common.loading': '読み込み中...',
    'common.error': 'エラー',
    'common.success': '成功',
    'common.cancel': 'キャンセル',
    'common.confirm': '確認',
    'common.retry': '再試行',
    'common.undo': '元に戻す',
    'agent.thinking': '思考中...',
    'agent.executing': '実行中...',
    'agent.completed': '完了',
    'agent.failed': '失敗',
  },
  'ko-KR': {
    'common.loading': '로딩 중...',
    'common.error': '오류',
    'common.success': '성공',
    'common.cancel': '취소',
    'common.confirm': '확인',
    'common.retry': '재시도',
    'common.undo': '실행 취소',
    'agent.thinking': '생각 중...',
    'agent.executing': '실행 중...',
    'agent.completed': '완료',
    'agent.failed': '실패',
  },
};

export interface I18nProviderProps {
  children: React.ReactNode;
  defaultLocale?: Locale;
  customTranslations?: Partial<Record<Locale, Record<string, string>>>;
}

export function I18nProvider({
  children,
  defaultLocale = 'en-US',
  customTranslations = {},
}: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  // Merge default and custom translations
  const mergedTranslations = useMemo(() => {
    const merged = { ...translations };
    for (const key of Object.keys(customTranslations)) {
      const k = key as Locale;
      if (customTranslations[k]) {
        merged[k] = { ...merged[k], ...customTranslations[k] };
      }
    }
    return merged;
  }, [customTranslations]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let value = mergedTranslations[locale]?.[key] || key;

      // Fallback to English if missing
      if (value === key && locale !== 'en-US') {
        value = mergedTranslations['en-US']?.[key] || key;
      }

      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, String(v));
        }
      }
      return value;
    },
    [locale, mergedTranslations],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
