"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = void 0;
const LOG_LEVEL_ORDER = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
const resolveLogLevel = () => {
    const configured = process.env.LOG_LEVEL?.toLowerCase();
    if (configured === 'debug' ||
        configured === 'info' ||
        configured === 'warn' ||
        configured === 'error') {
        return configured;
    }
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};
const shouldLog = (level) => {
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
const isSensitiveKey = (key) => {
    const normalized = key.replace(/[_-]/g, '').toLowerCase();
    return SENSITIVE_KEYS.has(normalized);
};
const serializeError = (error) => {
    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
    };
};
const redactDeep = (value, depth) => {
    if (depth <= 0)
        return '[Truncated]';
    if (value === null || value === undefined)
        return value;
    if (value instanceof Error) {
        return serializeError(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => redactDeep(item, depth - 1));
    }
    if (typeof value === 'object') {
        const obj = value;
        const redacted = {};
        for (const [key, item] of Object.entries(obj)) {
            if (isSensitiveKey(key)) {
                redacted[key] = REDACTED;
            }
            else {
                redacted[key] = redactDeep(item, depth - 1);
            }
        }
        return redacted;
    }
    return value;
};
const emit = (level, scope, message, meta) => {
    if (!shouldLog(level))
        return;
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
const createLogger = (scope) => {
    return {
        debug: (message, meta) => emit('debug', scope, message, meta),
        info: (message, meta) => emit('info', scope, message, meta),
        warn: (message, meta) => emit('warn', scope, message, meta),
        error: (message, meta) => emit('error', scope, message, meta),
    };
};
exports.createLogger = createLogger;
