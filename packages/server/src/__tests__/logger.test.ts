import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../utils/logger.js';

describe('createLogger', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Mock implementation
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Mock implementation
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('log levels', () => {
    it('should log info level messages', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    });

    it('should log error level messages', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    });

    it('should log warn level messages', () => {
      const logger = createLogger({ level: 'warn', format: 'text' });
      logger.warn('Warning message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
    });

    it('should log debug level messages when level is debug', () => {
      const logger = createLogger({ level: 'debug', format: 'text' });
      logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DEBUG'));
    });

    it('should not log debug messages when level is info', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log info messages when level is error', () => {
      const logger = createLogger({ level: 'error', format: 'text' });
      logger.info('Info message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log formats', () => {
    it('should format as JSON when format is json', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
      expect(parsed.key).toBe('value');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should format as text when format is text', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];

      expect(logOutput).toContain('INFO');
      expect(logOutput).toContain('Test message');
      expect(logOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
    });
  });

  describe('log data', () => {
    it('should include additional data in JSON format', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Test', { userId: '123', action: 'test' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.userId).toBe('123');
      expect(parsed.action).toBe('test');
    });

    it('should include additional data in text format', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.info('Test', { userId: '123' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('userId');
      expect(logOutput).toContain('123');
    });
  });

  describe('default level', () => {
    it('should use info as default level when level is undefined', () => {
      const logger = createLogger({ level: undefined, format: 'text' });

      logger.debug('Debug');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      logger.info('Info');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });
});
