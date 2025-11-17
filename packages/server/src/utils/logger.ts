import type { WukongServerConfig } from '../types.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LogData {
  [key: string]: any;
}

/**
 * Simple logger utility
 */
export function createLogger(config: Required<WukongServerConfig>['logging']) {
  const levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 999, // Silent suppresses all logs
  };

  const currentLevel = levelPriority[config.level ?? 'info'];

  function log(level: LogLevel, message: string, data?: LogData): void {
    if (levelPriority[level] < currentLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data,
    };

    const output =
      config.format === 'json'
        ? JSON.stringify(logEntry)
        : `[${timestamp}] ${level.toUpperCase()}: ${message} ${data ? JSON.stringify(data) : ''}`;

    // For now, just console output
    // In production, this could write to files, send to logging service, etc.
    const logFn = level === 'error' ? console.error : console.log;
    logFn(output);
  }

  return {
    debug: (message: string, data?: LogData) => log('debug', message, data),
    info: (message: string, data?: LogData) => log('info', message, data),
    warn: (message: string, data?: LogData) => log('warn', message, data),
    error: (message: string, data?: LogData) => log('error', message, data),
  };
}
