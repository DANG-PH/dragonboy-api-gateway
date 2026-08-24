export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordAlertPayload {
  title: string;
  color: number;
  fields: DiscordField[];
  description?: string;
}

const COLOR = {
  DO: 0xFF0000,    // critical / failed / xóa
  CAM: 0xFFA500,   // warning / sửa
  XANH: 0x00AA00,  // success / thêm
  XANH_DUONG: 0x3498DB, // info
} as const;

export class DiscordAlert {
  private static readonly webhookUrl = process.env.DISCORD_CIRCUIT_BOT_WEBHOOK_URL;
  private static readonly webhookEventGameUrl = process.env.DISCORD_GAME_EVENTS_BOT_WEBHOOK_URL;

  static async gui(payload: DiscordAlertPayload, webhookUrl: string): Promise<void> {
    if (!webhookUrl) {
      console.warn('[DiscordAlert] DISCORD_WEBHOOK_URL chưa được cấu hình, bỏ qua alert');
      return;
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: payload.title,
          color: payload.color,
          description: payload.description,
          timestamp: new Date().toISOString(),
          fields: payload.fields,
        }],
      }),
    }).catch(e => console.error('[DiscordAlert] Gửi alert thất bại:', e));
  }

  static async cbOpen(params: { serviceName: string; pid: number }): Promise<void> {
    await this.gui({
      title: '🔴 Circuit Breaker OPEN — service bị chặn',
      color: COLOR.DO,
      fields: [
        { name: 'Service',  value: params.serviceName, inline: true },
        { name: 'Instance', value: `pm2-${params.pid}`, inline: true },
        { name: 'Ý nghĩa',  value: 'CB đã trip sau 5 lần fail liên tiếp. Mọi request tới service này sẽ bị reject ngay, không qua network.' },
        { name: 'Cần làm',  value: 'Kiểm tra health của service. CB tự thử recover sau 10 giây (HALF-OPEN).' },
      ],
    }, this.webhookUrl);
  }

  static async cbClosed(params: { serviceName: string; pid: number }): Promise<void> {
    await this.gui({
      title: '✅ Circuit Breaker CLOSED — service đã recover',
      color: COLOR.XANH,
      fields: [
        { name: 'Service',  value: params.serviceName, inline: true },
        { name: 'Instance', value: `pm2-${params.pid}`, inline: true },
        { name: 'Ghi chú',  value: 'Request thử nghiệm ở HALF-OPEN thành công. CB đã tự đóng, traffic bình thường trở lại.' },
      ],
    }, this.webhookUrl);
  }

  // Alert khi admin thao tác item giới hạn thời gian trong shop NPC
  static async shopItemEvent(params: {
    action: 'THEM' | 'SUA' | 'XOA';
    admin: string;
    adminId: string | number;
    role: string;
    itemId?: number;
    npcBaseId?: number;
    startAt?: number | null;
    endAt?: number | null;
    extra?: Record<string, any>;
  }): Promise<void> {
    const actionMap = {
      THEM: { title: '🟢 Admin THÊM item giới hạn vào shop NPC', color: COLOR.XANH },
      SUA:  { title: '🟠 Admin SỬA item giới hạn trong shop NPC', color: COLOR.CAM },
      XOA:  { title: '🔴 Admin XÓA item giới hạn khỏi shop NPC',  color: COLOR.DO },
    };
    const { title, color } = actionMap[params.action];

    const fmt = (ts?: number | null) =>
      ts ? new Date(ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

    await this.gui({
      title,
      color,
      fields: [
        { name: 'Admin',     value: `${params.admin} (id: ${params.adminId})`, inline: true },
        { name: 'Role',      value: params.role, inline: true },
        { name: 'Item ID',   value: String(params.itemId ?? '—'), inline: true },
        { name: 'NPC Base',  value: String(params.npcBaseId ?? '—'), inline: true },
        { name: 'Start At',  value: fmt(params.startAt), inline: true },
        { name: 'End At',    value: fmt(params.endAt), inline: true },
        ...(params.extra
          ? [{ name: 'Chi tiết', value: '```json\n' + JSON.stringify(params.extra, null, 2).slice(0, 900) + '\n```' }]
          : []),
      ],
    }, this.webhookEventGameUrl);
  }
}