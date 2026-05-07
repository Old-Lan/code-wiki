type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

const currentLevel: LogLevel = (process.env.CODE_WIKI_LOG as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function formatMsg(level: LogLevel, msg: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const base = `[code-wiki] ${ts} ${level.toUpperCase()}: ${msg}`;
  return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
}

export const log = {
  debug: (msg: string, data?: unknown) => shouldLog('debug') && console.error(formatMsg('debug', msg, data)),
  info:  (msg: string, data?: unknown) => shouldLog('info')  && console.error(formatMsg('info', msg, data)),
  warn:  (msg: string, data?: unknown) => shouldLog('warn')  && console.error(formatMsg('warn', msg, data)),
  error: (msg: string, data?: unknown) => shouldLog('error') && console.error(formatMsg('error', msg, data)),
};