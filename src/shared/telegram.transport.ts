// src/logger/telegram.transport.ts
import TransportStream from 'winston-transport';
import axios from 'axios';

export class TelegramTransport extends TransportStream {
  private readonly botToken: string;
  private readonly chatId: string;

  constructor(options: { botToken: string; chatId: string }) {
    super();
    this.botToken = options.botToken;
    this.chatId = options.chatId;
  }

  async log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    if (info.level === 'info') {
      if (info.nhiemVu === 'thongBaoRutTien') {
        const message = `✅ Có user rút tiền\n\n` +
          `*UserId:* ${info.userId || 'Unknown'}\n\n` +
          `*CashierId (Người phê duyệt):* ${info.adminId || 'Unknown'}\n\n` +
          `*Số tiền rút:* ${info.amount || 'Unknown'}\n\n` +
          `*Thời gian:*  ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} \n\n`;

        try {
          await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            chat_id: this.chatId,
            text: message,
            parse_mode: 'Markdown',
          });
        } catch (error: any) {
          console.error('Failed to send Telegram message:', error.message);
        }
      }
    }

    callback();
  }
}
