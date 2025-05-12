/**
 * @file Supabase logging utility
 * @description Provides structured logging functionality for Supabase operations,
 * with configurable log levels and standardized formatting.
 */

/**
 * Log levels for categorizing message importance
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output (defaults to INFO in production, DEBUG in development) */
  minLevel: LogLevel;
  /** Whether to include timestamps in log output */
  timestamps: boolean;
  /** Whether to enable debug mode regardless of environment */
  debugMode: boolean;
  /** Optional custom formatter for log messages */
  formatter?: (level: LogLevel, module: string, message: string, data?: unknown) => string;
}

/**
 * Get the current logger configuration
 * 
 * The default configuration is determined by the environment:
 * - In development: DEBUG level with timestamps
 * - In production: INFO level without timestamps
 * 
 * This can be overridden by:
 * 1. Setting environment variables (NEXT_PUBLIC_SUPABASE_DEBUG=true)
 * 2. Passing a custom configuration to initLogger()
 * 
 * @returns The active logger configuration
 */
function getLoggerConfig(): LoggerConfig {
  const isDev = process.env.NODE_ENV === 'development';
  const debugModeEnv = process.env.NEXT_PUBLIC_SUPABASE_DEBUG === 'true';
  
  return {
    minLevel: isDev || debugModeEnv ? LogLevel.DEBUG : LogLevel.INFO,
    timestamps: isDev,
    debugMode: isDev || debugModeEnv,
  };
}

// Current logger configuration
let loggerConfig = getLoggerConfig();

/**
 * Initialize the logger with custom configuration
 * 
 * @param config - Custom logger configuration options
 * @returns The updated logger configuration
 * 
 * @example
 * ```typescript
 * import { initLogger, LogLevel } from '@/app/lib/supabase/logger';
 * 
 * // Initialize with custom configuration
 * initLogger({
 *   minLevel: LogLevel.WARN,
 *   timestamps: true,
 *   debugMode: true
 * });
 * ```
 */
export function initLogger(config: LoggerConfig): LoggerConfig {
  loggerConfig = { ...loggerConfig, ...config };
  return loggerConfig;
}

/**
 * Format a log message with consistent styling
 * 
 * @param level - The log level
 * @param module - The module/component name
 * @param message - The log message
 * @param data - Optional data to include in the log
 * @returns Formatted log message string
 */
function formatLogMessage(level: LogLevel, module: string, message: string, data?: unknown): string {
  const levelStr = LogLevel[level].padEnd(5, ' ');
  const timestamp = loggerConfig.timestamps ? '[' + new Date().toISOString() + '] ' : '';
  const moduleStr = module ? '[supabase/' + module + '] ' : '';
  
  let result = timestamp + levelStr + ' ' + moduleStr + message;
  
  if (data !== undefined) {
    try {
      const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
      result += ' ' + dataStr;
    } catch (e) {
      result += ' [Unstringifiable data]';
    }
  }
  
  return result;
}

/**
 * Log a message at a specific log level
 * 
 * @param level - The log level for this message
 * @param module - The module/component name
 * @param message - The log message
 * @param data - Optional data to include in the log
 */
export function log(level: LogLevel, module: string, message: string, data?: unknown): void {
  if (level < loggerConfig.minLevel) return;
  
  const formattedMessage = loggerConfig.formatter 
    ? loggerConfig.formatter(level, module, message, data)
    : formatLogMessage(level, module, message, data);
  
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage);
      break;
    case LogLevel.INFO:
      console.info(formattedMessage);
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage);
      break;
    case LogLevel.ERROR:
      console.error(formattedMessage);
      break;
  }
}

/**
 * Log a debug message
 * 
 * @param module - The module/component name
 * @param message - The log message
 * @param data - Optional data to include in the log
 * 
 * @example
 * ```typescript
 * import { debug } from '@/app/lib/supabase/logger';
 * 
 * debug('browser', 'Fetching user profile', { userId: '123' });
 * ```
 */
export function debug(module: string, message: string, data?: any): void {
  log(LogLevel.DEBUG, module, message, data);
}

/**
 * Log an info message
 * 
 * @param module - The module/component name
 * @param message - The log message
 * @param data - Optional data to include in the log
 * 
 * @example
 * ```typescript
 * import { info } from '@/app/lib/supabase/logger';
 * 
 * info('server', 'User authenticated successfully', { user: userEmail });
 * ```
 */
export function info(module: string, message: string, data?: any): void {
  log(LogLevel.INFO, module, message, data);
}

/**
 * Log a warning message
 * 
 * @param module - The module/component name
 * @param message - The log message
 * @param data - Optional data to include in the log
 * 
 * @example
 * ```typescript
 * import { warn } from '@/app/lib/supabase/logger';
 * 
 * warn('admin', 'Unexpected query performance', { queryTime: 1500 });
 * ```
 */
export function warn(module: string, message: string, data?: any): void {
  log(LogLevel.WARN, module, message, data);
}

/**
 * Log an error message
 * 
 * @param module - The module/component name
 * @param message - The log message
 * @param data - Optional data (e.g. error object) to include in the log
 * 
 * @example
 * ```typescript
 * import { error } from '@/app/lib/supabase/logger';
 * 
 * try {
 *   // Some operation that might fail
 * } catch (err) {
 *   error('browser', 'Failed to update user profile', err);
 * }
 * ```
 */
export function error(module: string, message: string, data?: any): void {
  log(LogLevel.ERROR, module, message, data);
}

/**
 * Create a logger instance bound to a specific module
 * 
 * @param module - The module/component name to bind
 * @returns An object with logging methods bound to the specified module
 * 
 * @example
 * ```typescript
 * import { createLogger } from '@/app/lib/supabase/logger';
 * 
 * // Create a logger for the browser client
 * const logger = createLogger('browser');
 * 
 * // Now use it without specifying the module each time
 * logger.info('Initializing client');
 * logger.error('Authentication failed', errorObject);
 * ```
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, data?: any) => debug(module, message, data),
    info: (message: string, data?: any) => info(module, message, data),
    warn: (message: string, data?: any) => warn(module, message, data),
    error: (message: string, data?: any) => error(module, message, data),
    log: (level: LogLevel, message: string, data?: any) => log(level, module, message, data),
  };
}

export default {
  initLogger,
  createLogger,
  debug,
  info,
  warn,
  error,
  log,
  LogLevel,
};
