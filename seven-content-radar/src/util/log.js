import { redact } from './misc.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const current = LEVELS[process.env.RADAR_LOG_LEVEL || 'info'] ?? 20;

function emit(level, msg, data) {
  if (LEVELS[level] < current) return;
  const line = { ts: new Date().toISOString(), level, msg: redact(msg) };
  if (data !== undefined) line.data = JSON.parse(redact(JSON.stringify(data)));
  const out = JSON.stringify(line);
  if (level === 'error' || level === 'warn') process.stderr.write(`${out}\n`);
  else process.stdout.write(`${out}\n`);
}

export const log = {
  debug: (m, d) => emit('debug', m, d),
  info: (m, d) => emit('info', m, d),
  warn: (m, d) => emit('warn', m, d),
  error: (m, d) => emit('error', m, d),
};
