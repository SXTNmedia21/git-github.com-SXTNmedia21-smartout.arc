// ============================================
// telegram.ts
// Type definitions for the Telegram Bot API webhook payloads.
// Only the subset we consume — not the full Telegram API.
// Connected to: src/routes/adapters/telegram.ts (webhook handler)
// ============================================

/** Telegram user object */
export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

/** Telegram chat object */
export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  first_name?: string;
  last_name?: string;
  username?: string;
};

/** Telegram message object */
export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
  }>;
};

/** Callback query from inline keyboard button press */
export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance: string;
  data?: string;
};

/** Poll answer from the admin */
export type TelegramPollAnswer = {
  poll_id: string;
  user: TelegramUser;
  option_ids: number[];
};

/** Webhook update — the top-level object Telegram sends */
export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  poll_answer?: TelegramPollAnswer;
};

/** Inline keyboard button */
export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
};

/** Inline keyboard markup for message replies */
export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

/** Options for sendMessage */
export type SendMessageOptions = {
  chat_id: number | string;
  text: string;
  parse_mode?: "MarkdownV2" | "HTML";
  reply_markup?: InlineKeyboardMarkup;
};

/** Options for sendPoll */
export type SendPollOptions = {
  chat_id: number | string;
  question: string;
  options: string[];
  is_anonymous?: boolean;
  allows_multiple_answers?: boolean;
};

/** Generic Telegram Bot API response */
export type TelegramApiResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
};
