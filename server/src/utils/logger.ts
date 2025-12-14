type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const resolveLogLevel = (): LogLevel => {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (
    configured === 'debug' ||
    configured === 'info' ||
    configured === 'warn' ||
    configured === 'error'
  ) {
    return configured;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

const shouldLog = (level: LogLevel) => {
  const threshold = resolveLogLevel();
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[threshold];
};

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'email',
  'pushtoken',
  'accesstoken',
  'refreshtoken',
]);

const isSensitiveKey = (key: string) => {
  const normalized = key.replace(/[_-]/g, '').toLowerCase();
  return SENSITIVE_KEYS.has(normalized);
};

const serializeError = (error: Error) => {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
};

const redactDeep = (value: unknown, depth: number): unknown => {
  if (depth <= 0) return '[Truncated]';
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, depth - 1));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        redacted[key] = REDACTED;
      } else {
        redacted[key] = redactDeep(item, depth - 1);
      }
    }
    return redacted;
  }

  return value;
};

type LogMeta = Record<string, unknown>;

const emit = (level: LogLevel, scope: string | undefined, message: string, meta?: LogMeta) => {
  if (!shouldLog(level)) return;

  const prefix = scope ? `[${scope}] ` : '';
  const ts = new Date().toISOString();
  const line = `${ts} ${level.toUpperCase()} ${prefix}${message}`;

  const payload = meta ? redactDeep(meta, 6) : undefined;

  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line, payload ?? '');
    return;
  }

  if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line, payload ?? '');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(line, payload ?? '');
};

export const createLogger = (scope?: string) => {
  return {
    debug: (message: string, meta?: LogMeta) => emit('debug', scope, message, meta),
    info: (message: string, meta?: LogMeta) => emit('info', scope, message, meta),
    warn: (message: string, meta?: LogMeta) => emit('warn', scope, message, meta),
    error: (message: string, meta?: LogMeta) => emit('error', scope, message, meta),
  };
};

