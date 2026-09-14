// Wires storage + adapters + orchestrator. Used by the Apify actor entry point,
// the local CLI and the tests (which inject fakes).
import { config } from './config.js';
import { FileStore } from './storage/store.js';
import { ApifySource } from './apify/client.js';
import { AiEngine } from './ai/client.js';
import { TelegramBot } from './telegram/api.js';
import { Radar } from './engine/radar.js';
import { TelegramHandlers } from './telegram/handlers.js';

export async function bootstrap({ store, apify, ai, bot, chatId } = {}) {
  const s = store || (await new FileStore(config.dataDir).init());
  const radar = new Radar({
    store: s,
    apify: apify || new ApifySource(),
    ai: ai || new AiEngine(),
    bot: bot === undefined ? (config.telegramToken ? new TelegramBot() : null) : bot,
    chatId: chatId ?? config.telegramChatId,
  });
  radar.ensureWatchlist();
  await s.flush();
  const handlers = radar.bot ? new TelegramHandlers({ radar, bot: radar.bot }) : null;
  return { store: s, radar, handlers };
}
