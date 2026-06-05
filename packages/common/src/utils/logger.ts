// ============================================
// DeskLink — Structured Logger
// JSON-structured logging with context propagation
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  child(context: LogContext): Logger;
}

/**
 * Create a structured JSON logger.
 * In production, output is JSON (for log aggregation).
 * In development, output is human-readable.
 */
export function createLogger(
  component: string,
  options: { level?: LogLevel; pretty?: boolean } = {},
): Logger {
  const minLevel = LOG_LEVELS[options.level ?? 'info'];
  const pretty = options.pretty ?? process.env.NODE_ENV !== 'production';
  const baseContext: LogContext = { component };

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= minLevel;
  }

  function formatEntry(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...baseContext,
      ...context,
      ...(error
        ? {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }
        : {}),
    };

    if (pretty) {
      const levelColors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      };
      const reset = '\x1b[0m';
      const time = entry.timestamp.split('T')[1].replace('Z', '');
      const ctx = Object.entries({ ...baseContext, ...context })
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      return `${levelColors[level]}${time} [${level.toUpperCase().padEnd(5)}]${reset} ${message} ${ctx}${error ? `\n${error.stack}` : ''}`;
    }

    return JSON.stringify(entry);
  }

  function write(level: LogLevel, output: string) {
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  const logger: Logger = {
    debug(message: string, context?: LogContext) {
      if (shouldLog('debug')) write('debug', formatEntry('debug', message, context));
    },
    info(message: string, context?: LogContext) {
      if (shouldLog('info')) write('info', formatEntry('info', message, context));
    },
    warn(message: string, context?: LogContext) {
      if (shouldLog('warn')) write('warn', formatEntry('warn', message, context));
    },
    error(message: string, error?: Error, context?: LogContext) {
      if (shouldLog('error')) write('error', formatEntry('error', message, context, error));
    },
    child(_childContext: LogContext): Logger {
      return createLogger(component, options);
    },
  };

  // Fix the child implementation to actually merge context
  logger.child = (childContext: LogContext): Logger => {
    const childLogger = createLogger(component, options);
    Object.assign(baseContext, childContext);
    return childLogger;
  };

  return logger;
}
