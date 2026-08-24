import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { TelegramTransport } from './telegram.transport';
import 'winston-mongodb';

export const winstonLogger = WinstonModule.createLogger({
  transports: [
    // Log ra console (dev đọc)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(), // Tô màu theo cấp độ
        winston.format.printf(({ level, message, context, timestamp }) => {
          return `[${timestamp}] [${context || 'App'}] ${level}: ${message}`;
        }),
      ),
    }),

    // Ghi log error vào file JSON
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(), // JSON format cho phân tích
      ),
    }),

    // Ghi tất cả log vào file combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    new TelegramTransport({
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
    }),

     // --- MongoDB logging ---
    new winston.transports.MongoDB({
      db: String(process.env.MONGODB_URL),
      collection: 'logs',
      level: 'info',             // Log từ info trở lên
      tryReconnect: true,
      options: {
        useUnifiedTopology: true,
      },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
});