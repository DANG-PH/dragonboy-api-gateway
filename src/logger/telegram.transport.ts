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

    if (info.level === 'error') {
      const message = `🆘 Có Lỗi Mới\n\n` +
        `*Admin test:* ${info.admin || 'Unknown'}\n\n` +
        `*Thời gian lỗi:*  ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} \n\n` +
        `*Service bị lỗi:* ${info.service || 'Unknown'}\n\n` +
        `*Message:*\n${info.message}\n\n`;

      try {
        await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
        });
      } catch (error) {
        console.error('Failed to send Telegram message:', error.message);
      }
    }

    if (info.level === 'info') {
      if (info.nhiemVu === 'thongBaoLoginUser') {
        const message = `✅ Có user đăng nhập\n\n` +
          `*Username:* ${info.username || 'Unknown'}\n\n` +
          `*Thời gian:*  ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} \n\n`;

        try {
          await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            chat_id: this.chatId,
            text: message,
            parse_mode: 'Markdown',
          });
        } catch (error) {
          console.error('Failed to send Telegram message:', error.message);
        }
      }
      if (info.nhiemVu === 'thongBaoNapTien') {
        const message = `✅ Có user gửi yêu cầu nạp tiền\n\n` +
          `*Username:* ${info.username || 'Unknown'}\n\n` +
          `*Thời gian:*  ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} \n\n`;

        try {
          await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            chat_id: this.chatId,
            text: message,
            parse_mode: 'Markdown',
          });
        } catch (error) {
          console.error('Failed to send Telegram message:', error.message);
        }
      }
      if (info.nhiemVu === 'thongBaoDoanhThu') {
        const message = `✅ Thống kê doanh thu ( Ngọc Rồng Online )\n\n` +
          `*Doanh thu:* ${info.doanhThu || 'Unknown'}\n\n` +
          `*Thời gian:*  ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} \n\n`;

        try {
          await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            chat_id: this.chatId,
            text: message,
            parse_mode: 'Markdown',
          });
        } catch (error) {
          console.error('Failed to send Telegram message:', error.message);
        }
      }
    }

    callback();
  }
}
