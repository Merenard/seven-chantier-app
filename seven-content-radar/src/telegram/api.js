import { config } from '../config.js';
import { retry } from '../util/misc.js';
import { log } from '../util/log.js';

export class TelegramError extends Error {
  constructor(message, { code, description } = {}) {
    super(message);
    this.name = 'TelegramError';
    this.code = code;
    this.description = description;
  }
}

// Telegram Bot API client. `fetchImpl` is injectable for tests.
export class TelegramBot {
  constructor({ token = config.telegramToken, fetchImpl = globalThis.fetch } = {}) {
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
    this.base = `https://api.telegram.org/bot${token}`;
    this.fetch = fetchImpl;
  }

  async call(method, payload = {}) {
    return retry(async () => {
      const res = await this.fetch(`${this.base}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        const err = new TelegramError(`Telegram ${method} failed: ${body.description || res.status}`, { code: body.error_code || res.status, description: body.description });
        throw err;
      }
      return body.result;
    }, {
      retries: 3,
      baseMs: 1000,
      shouldRetry: (err) => !(err.code >= 400 && err.code < 500 && err.code !== 429),
      onRetry: (err, attempt, delay) => log.warn('telegram retry', { method, attempt, delay, error: err.message }),
    });
  }

  // Telegram caps messages at 4096 chars: long texts are split on paragraph boundaries.
  async sendMessage(chatId, text, { keyboard, parseMode = 'HTML', disablePreview = true } = {}) {
    const chunks = splitMessage(text, 3900);
    let last = null;
    for (let i = 0; i < chunks.length; i += 1) {
      const isLast = i === chunks.length - 1;
      last = await this.call('sendMessage', {
        chat_id: chatId,
        text: chunks[i],
        parse_mode: parseMode,
        link_preview_options: { is_disabled: disablePreview },
        reply_markup: isLast && keyboard ? { inline_keyboard: keyboard } : undefined,
      });
    }
    return last;
  }

  answerCallback(callbackQueryId, text) {
    return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, text: text ? text.slice(0, 190) : undefined });
  }

  editKeyboard(chatId, messageId, keyboard) {
    return this.call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard || [] } });
  }

  setWebhook(url, { secret } = {}) {
    return this.call('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
  }

  deleteWebhook() {
    return this.call('deleteWebhook', {});
  }

  getUpdates(offset) {
    return this.call('getUpdates', { offset, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  }

  setCommands(commands) {
    return this.call('setMyCommands', { commands });
  }

  getMe() {
    return this.call('getMe');
  }
}

export function splitMessage(text, max = 3900) {
  if (text.length <= max) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
