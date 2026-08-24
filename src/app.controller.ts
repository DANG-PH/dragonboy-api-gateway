import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { getAllBreakerStates } from './helpers/circuit-breaker.registry';
// import { PlayerManagerService } from './service/admin/player_manager/player_manager.service';

@Controller()
@ApiTags('Api App')
export class AppController {
  // constructor(private readonly playerManagerService: PlayerManagerService) {}

  @Get()
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'Xem tình trạng gateway của server' })
  async getServerInfo() {
    const timestamp = new Date(Date.now()).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const env = process.env.NODE_ENV || 'development';
    const uptime = this.formatUptime(process.uptime());
    const swaggerUrl = `https://api.ngocrongdark.com/api-docs`;
    const frontendUrl = 'https://ngocrongdark.com';
    const adminUrl = 'https://admin.ngocrongdark.com';

    // Fetch version from GitHub
    let version = '1.0';
    let jarUrl = '#';

    const versionRes = await fetch('https://raw.githubusercontent.com/DANG-PH/NRO_ONLINE/master/version.json')
    const data = await versionRes.json();
    version = data.version || version;
    jarUrl = data.jar || jarUrl;

    // Lấy CB states để hiển thị trong server info page
    const cbStates = getAllBreakerStates();
    const cbEntries = Object.entries(cbStates);

    // Render từng service thành 1 row trong bảng
    // Màu tag theo state: CLOSED=green, OPEN=đỏ, HALF-OPEN=vàng, ISOLATED=tím
    const cbStateTag = (state: string) => {
      const map: Record<string, string> = {
        'CLOSED':    'tag-green',
        'OPEN':      'tag-red',
        'HALF-OPEN': 'tag-gold',
        'ISOLATED':  'tag-purple',
      };
      return map[state] ?? 'tag-blue';
    };

    const cbRows = cbEntries.length === 0
      ? `<tr><td colspan="2" style="color:rgba(255,255,255,0.3);font-size:12px;">Chưa có service nào được gọi</td></tr>`
      : cbEntries.map(([service, state]) => `
          <tr>
            <td>${service}</td>
            <td><span class="tag ${cbStateTag(state)}">${state}</span></td>
          </tr>
        `).join('');

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <link rel="icon" type="image/png" href="https://avatarfiles.alphacoders.com/110/110487.png">
        <title>Server Info – Ngọc Rồng Online</title>
        <link href="https://fonts.googleapis.com/css2?family=Bangers&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Nunito', sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background:
              radial-gradient(ellipse at 20% 30%, rgba(255,100,0,0.45) 0%, transparent 55%),
              radial-gradient(ellipse at 80% 70%, rgba(200,50,0,0.40) 0%, transparent 55%),
              url('https://img00.deviantart.net/43b4/i/2017/109/b/d/dragon_ball_super_all_characters_by_thesaiyanrain6569-db6g1iv.jpg') no-repeat center center / cover;
            padding: 24px;
          }
          .card {
            width: 100%; max-width: 780px;
            background: rgba(8,4,2,0.72);
            backdrop-filter: blur(18px);
            border: 1.5px solid rgba(255,160,30,0.35);
            border-radius: 20px;
            padding: 36px 40px 32px;
            box-shadow: 0 0 60px rgba(255,100,0,0.25), inset 0 0 40px rgba(0,0,0,0.3);
            position: relative; overflow: hidden;
          }
          .card::before {
            content: ''; position: absolute;
            top: -60px; right: -60px;
            width: 220px; height: 220px; border-radius: 50%;
            background: radial-gradient(circle, rgba(255,130,0,0.15) 0%, transparent 70%);
            pointer-events: none;
          }
          .header { text-align: center; margin-bottom: 28px; }
          .title {
            font-family: 'Bangers', cursive; font-size: 46px;
            letter-spacing: 3px; line-height: 1; color: #fff;
            text-shadow: 0 0 20px rgba(255,140,0,0.9), 0 0 40px rgba(255,80,0,0.5),
              3px 3px 0 #8B2500, 5px 5px 0 #4A1200;
          }
          .title span { color: #FFD700; }
          .badge {
            display: inline-block; margin-top: 8px;
            padding: 4px 18px; border-radius: 30px;
            background: linear-gradient(90deg, rgba(255,100,0,0.3), rgba(255,200,0,0.25));
            border: 1px solid rgba(255,180,0,0.4);
            font-size: 12px; letter-spacing: 2px; text-transform: uppercase;
            color: #FFD78A; font-weight: 700;
          }
          .status-dot {
            display: inline-block; width: 8px; height: 8px; border-radius: 50%;
            background: #57ff80; margin-right: 6px;
            box-shadow: 0 0 6px #57ff80;
            animation: pulse 2s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.85); }
          }
          .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,160,30,0.5), transparent);
            margin: 20px 0;
          }
          .cols { display: flex; gap: 32px; }
          .col { flex: 1; min-width: 0; }
          .section-title {
            font-family: 'Bangers', cursive; font-size: 16px; letter-spacing: 1.5px;
            color: #FFB020; text-transform: uppercase;
            margin: 18px 0 8px;
            display: flex; align-items: center; gap: 8px;
          }
          .section-title::after {
            content: ''; flex: 1; height: 1px;
            background: linear-gradient(90deg, rgba(255,160,30,0.4), transparent);
          }
          table { width: 100%; border-collapse: collapse; }
          td {
            padding: 6px 0; font-size: 14px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            color: #e0c9a0; vertical-align: middle;
          }
          td:first-child { color: #FFA040; font-weight: 700; width: 44%; font-size: 13px; }
          .tag {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 3px 10px; border-radius: 20px;
            font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
          }
          .tag-orange { background: rgba(255,120,0,0.2); border: 1px solid rgba(255,120,0,0.4); color: #FFAA50; }
          .tag-gold   { background: rgba(255,200,0,0.15); border: 1px solid rgba(255,200,0,0.35); color: #FFD060; }
          .tag-green  { background: rgba(87,255,128,0.1); border: 1px solid rgba(87,255,128,0.3); color: #80FFAA; }
          .tag-blue   { background: rgba(100,180,255,0.12); border: 1px solid rgba(100,180,255,0.3); color: #90CCFF; }
          .tag-purple { background: rgba(180,100,255,0.12); border: 1px solid rgba(180,100,255,0.3); color: #CC99FF; }
          /* Tag đỏ cho CB OPEN — trạng thái nguy hiểm cần highlight rõ */
          .tag-red    { background: rgba(255,60,60,0.2); border: 1px solid rgba(255,60,60,0.45); color: #FF8080; }
          .tech-grid  { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
          .download-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 5px 14px; border-radius: 20px;
            background: linear-gradient(90deg, rgba(255,120,0,0.25), rgba(255,200,0,0.2));
            border: 1px solid rgba(255,160,0,0.45);
            color: #FFD060; font-size: 12px; font-weight: 700;
            text-decoration: none; letter-spacing: 0.5px;
            transition: all 0.2s;
          }
          .download-btn:hover {
            background: linear-gradient(90deg, rgba(255,120,0,0.4), rgba(255,200,0,0.35));
            box-shadow: 0 0 12px rgba(255,160,0,0.3);
            color: #fff;
          }
          .footer {
            margin-top: 24px; text-align: center;
            font-size: 12px; color: rgba(255,180,80,0.5); letter-spacing: 1px;
          }
          .dragon-ball {
            display: inline-block; width: 14px; height: 14px; border-radius: 50%;
            background: radial-gradient(circle at 35% 35%, #FFE566, #FF8800);
            border: 1.5px solid rgba(255,150,0,0.6);
            margin: 0 2px; vertical-align: middle;
          }
          a { color: #80ffea; text-decoration: none; font-weight: 700; }
          @media (max-width: 600px) {
            .cols { flex-direction: column; } .card { padding: 24px 20px; } .title { font-size: 34px; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="title">Ngọc Rồng <span>Online</span></div>
            <div style="margin-top:10px;">
              <span class="badge"><span class="status-dot"></span>Server Running</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="cols">
            <div class="col">
              <div class="section-title">⚙️ Hệ thống</div>
              <table>
                <tr><td>Môi trường</td><td><span class="tag tag-orange">${env}</span></td></tr>
                <tr><td>Trạng thái</td><td><span class="tag tag-green">● Online</span></td></tr>
              </table>

              <div class="section-title">🖥️ Client</div>
              <table>
                <tr><td>Game Engine</td><td><span class="tag tag-orange">LibGDX</span></td></tr>
                <tr><td>Ngôn ngữ</td><td><span class="tag tag-gold">Java</span></td></tr>
                <tr><td>Platform</td><td><span class="tag tag-blue">Desktop (.jar)</span></td></tr>
              </table>

              <div class="section-title">🔗 API</div>
              <table>
                <tr><td>Framework</td><td><span class="tag tag-orange">NestJS</span></td></tr>
                <tr><td>Runtime</td><td><span class="tag tag-green">Node.js</span></td></tr>
                <tr><td>Docs</td><td><a href="${swaggerUrl}" target="_blank">Swagger UI ↗</a></td></tr>
                <tr><td>Dashboard</td><td><a href="'https://api.ngocrongdark.com/server/dashboard'" target="_blank">Dashboard ↗</a></td></tr>
              </table>

              <!-- Circuit Breaker status — hiển thị state của từng downstream service -->
              <!-- Lazy init: chỉ xuất hiện sau khi service được gọi lần đầu -->
              <div class="section-title">⚡ Circuit Breakers</div>
              <table>
                ${cbRows}
              </table>
            </div>

            <div class="col">
              <div class="section-title">🚀 Release</div>
              <table>
                <tr>
                  <td>Phiên bản</td>
                  <td><span class="tag tag-gold">v${version}</span></td>
                </tr>
                <tr>
                  <td>Tải game</td>
                  <td>
                    <a class="download-btn" href="https://github.com/DANG-PH/NRO_ONLINE/releases/download/v1.0.0/NRO_HDG.zip" target="_blank">
                      ⬇ Download .zip
                    </a>
                  </td>
                </tr>
              </table>

              <div class="section-title">🌐 Links</div>
              <table>
                <tr><td>Frontend</td><td><a href="${frontendUrl}" target="_blank">User Portal ↗</a></td></tr>
                <tr><td>Admin</td><td><a href="${adminUrl}" target="_blank">Admin Panel ↗</a></td></tr>
                <tr><td>GitHub</td><td><a href="https://github.com/DANG-PH/NRO_ONLINE" target="_blank">NRO_ONLINE ↗</a></td></tr>
              </table>

              <div class="section-title">📡 Hạ tầng</div>
              <div class="tech-grid">
                <span class="tag tag-orange">Docker</span>
                <span class="tag tag-gold">Redis</span>
                <span class="tag tag-green">RabbitMQ</span>
                <span class="tag tag-blue">MySQL</span>
                <span class="tag tag-orange">Ubuntu VPS</span>
                <span class="tag tag-gold">Jaeger</span>
              </div>

              <div class="section-title">🕐 Thời gian</div>
              <table>
                <tr><td>Múi giờ</td><td style="color:#e0c9a0;">Asia/Ho_Chi_Minh</td></tr>
                <tr><td>Timestamp</td><td style="color:#e0c9a0;font-size:13px;">${timestamp}</td></tr>
                <tr><td>Uptime</td><td><span class="tag tag-green">⏱ ${uptime}</span></td></tr>
              </table>
            </div>
          </div>

          <div class="divider"></div>

          <div class="footer">
            <span class="dragon-ball"></span>
            <span class="dragon-ball"></span>
            <span class="dragon-ball"></span>
            Phạm Hải Đăng · Backend · Game Developer
            <span class="dragon-ball"></span>
            <span class="dragon-ball"></span>
            <span class="dragon-ball"></span>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d} ngày ${h} giờ ${m} phút`;
    if (h > 0) return `${h} giờ ${m} phút ${s} giây`;
    return `${m} phút ${s} giây`;
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check cho CI/CD' })
  async healthCheck() {
    return { success: true };
  }

  @Get('health/circuit-breakers')
  @ApiOperation({ summary: 'Circuit Breaker states của tất cả downstream service' })
  async circuitBreakerHealth() {
    const breakers = getAllBreakerStates();

    // degraded khi có service OPEN hoặc ISOLATED
    // → monitoring/alerting tool có thể poll endpoint này
    const hasOpenBreaker = Object.values(breakers).some(
      state => state === 'OPEN' || state === 'ISOLATED'
    );

    return {
      status: hasOpenBreaker ? 'degraded' : 'ok',
      circuitBreakers: breakers,
      timestamp: new Date().toISOString(),
    };
  }
}