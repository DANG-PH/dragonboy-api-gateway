import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';

@Controller('server')
@ApiTags('Api Server')
export class ServerController {
  constructor() {}

  @Get('health')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Xem tình trạng gateway của server' })
  @Header('Content-Type', 'text/html')
  healthCheck() {
    const status = 'OK';
    const timestamp = new Date(Date.now()).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Health Check</title>
        <link rel="icon" type="image/png" href="https://avatarfiles.alphacoders.com/110/110487.png">
        <style>
          body {
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: url('https://i.pinimg.com/originals/fd/ea/ff/fdeaff0efe3b9f014f0be734224a5219.png') no-repeat center center;
            background-size: cover;
          }
          .card {
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);

            padding: 30px 40px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.1);

            box-shadow: 0 8px 30px rgba(0,0,0,0.5);

            text-align: center;
            max-width: 420px;
            color: #fff;
          }
          h1 {
            color: #f1f1f1;
          }
          h1 .ok {
            color: #57ff80;
            font-weight: bold;
          }
          p {
            color: #e5e5e5;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Health Status: <span class="ok">${status}</span></h1>
          <p>Thời gian kiểm tra: ${timestamp}</p>
        </div>
      </body>
      </html>
    `;
  }

  @Get('dashboard')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Hiển thị các service backend' })
  @Header('Content-Type', 'text/html') // đảm bảo browser hiểu HTML
  dashboard(): string {
    return `
      <html>
      <head>
        <title>Backend Dashboard</title>
        <link rel="icon" type="image/png" href="https://avatarfiles.alphacoders.com/110/110487.png">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

          body {
            font-family: 'Inter', sans-serif;
            background: #fff;
            color: #111;
            margin: 0;
            padding: 0;
          }

          header {
            background-color: #000;
            color: #fff;
            padding: 25px;
            text-align: center;
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: 1px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          header {
            background: linear-gradient(90deg, #000, #333);
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          }

          main {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 25px;
            padding: 40px;
            max-width: 1200px;
            margin: auto;
          }

          .card {
            background: #f9f9f9;
            border: 1px solid #ccc;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
          }

          .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.1);
          }

          .card img {
            width: 60px;
            height: 60px;
            margin-bottom: 15px;
          }

          .card h3 {
            margin: 10px 0;
            font-size: 1.2rem;
          }

          .card p {
            font-size: 0.95rem;
            color: #555;
            margin-bottom: 15px;
          }

          .card a {
            display: inline-block;
            padding: 8px 15px;
            border: 1px solid #111;
            border-radius: 6px;
            text-decoration: none;
            color: #111;
            font-weight: 600;
            transition: background 0.2s, color 0.2s;
          }

          .card a:hover {
            background: #111;
            color: #fff;
          }

          footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9rem;
          }

          footer .social-icons {
            margin-top: 10px;
          }

          footer .social-icons a {
            display: inline-block;
            margin: 0 8px;
            transition: transform 0.2s, opacity 0.2s;
          }

          footer .social-icons a:hover {
            transform: scale(1.2);
            opacity: 0.8;
          }

          footer .social-icons img {
            width: 24px;
            height: 24px;
            vertical-align: middle;
          }

          @media (max-width: 600px) {
            main {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <header>
          <div>HDG STUDIO</div>
          <img style="width:60px" src="https://avatarfiles.alphacoders.com/110/110487.png">
        </header>
        <main>
          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/clipboard.png"/>
            <h3>Server Docs</h3>
            <p>Mô tả công dụng của server.</p>
            <a href="http://${process.env.HOST}:${process.env.PORT}/server/docs" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/server.png"/>
            <h3>Server</h3>
            <p>Truy cập server backend chính.</p>
            <a href="http://${process.env.HOST}:${process.env.PORT}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/api.png"/>

            <h3>Swagger</h3>
            <p>Xem tài liệu API của project.</p>
            <a href="http://${process.env.HOST}:${process.env.PORT}/${process.env.ENDPOINT_SWAGGER}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/monitor.png"/>
            <h3>Jaeger</h3>
            <p>Giám sát tracing cho server.</p>
            <a href="http://${process.env.HOST}:${process.env.JAEGER_PORT}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/mysql-logo.png"/>
            <h3>PHP Admin</h3>
            <p>Quản lý cơ sở dữ liệu MySQL.</p>
            <a href="http://${process.env.HOST}:${process.env.PHP_ADMIN_PORT}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/database.png"/>
            <h3>Adminer</h3>
            <p>Quản lý database linh hoạt.</p>
            <a href="http://${process.env.HOST}:${process.env.ADMINER_PORT}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/rabbit.png"/>
            <h3>RabbitMQ Admin</h3>
            <p>Quản lý hàng đợi RabbitMQ.</p>
            <a href="http://${process.env.HOST}:${process.env.RABBIT_ADMIN_PORT}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/redis.png"/>
            <h3>RedisInsight</h3>
            <p>Quản lý Redis và xem docs.</p>
            <a href="http://${process.env.HOST}:${process.env.REDISINSIGHT_PORT}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/leaf.png"/>
            <h3>Mongo Express</h3>
            <p>Quản lí database MongoDB.</p>
            <a href="http://${process.env.MONGO_MANAGER_URL}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/computer.png"/>
            <h3>Ngrok Manager</h3>
            <p>Quản lí server sau khi đã kết nối internet.</p>
            <a href="${process.env.NGROK_URL}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/elephant.png"/>
            <h3>PgAdmin 4</h3>
            <p>Quản lí database PostgreSQL.</p>
            <a href="${process.env.PGADMIN_URL}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/heart-with-pulse.png"/>
            <h3>Health Check</h3>
            <p>Xem trạng thái server.</p>
            <a href="http://${process.env.HOST}:${process.env.PORT}/server/health" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/document.png"/>
            <h3>Logging Winston</h3>
            <p>Xem log của server.</p>
            <a href="http://${process.env.HOST}:${process.env.PORT}/server/log" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/000000/console.png"/>
            <h3>System Manager</h3>
            <p>Xem bộ nhớ, CPU, ... của server</p>
            <a href="http://${process.env.HOST}:${process.env.PORT}/server/memory" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/web.png"/>
            <h3>Frontend User</h3>
            <p>Trang web cho User.</p>
            <a href="${process.env.WEB_USER_URL}" target="_blank">Xem chi tiết</a>
          </div>

          <div class="card">
            <img src="https://img.icons8.com/ios-filled/100/user-shield.png"/>
            <h3>Frontend Admin</h3>
            <p>Trang web cho Admin.</p>
            <a href="${process.env.WEB_ADMIN_URL}" target="_blank">Xem chi tiết</a>
          </div>
        </main>
        <footer>
          Backend Dashboard - Hải Đăng © ${new Date().getFullYear()}
          <div class="social-icons">
            <a href="https://github.com/DANG-PH" target="_blank" title="GitHub">
              <img src="https://i.imgflip.com/7an9j1.png" alt="GitHub"/>
            </a>
            <a href="https://facebook.com/danghaipham" target="_blank" title="Facebook">
              <img src="https://cdn.pixabay.com/photo/2020/09/28/18/43/facebook-5610792_640.png" alt="Facebook"/>
            </a>
            <a href="https://linkedin.com/in/danghaipham" target="_blank" title="LinkedIn">
              <img src="https://cdn1.iconfinder.com/data/icons/logotypes/32/circle-linkedin-512.png" alt="LinkedIn"/>
            </a>
          </div>
        </footer>
      </body>
      </html>
      `;

  }

  @Get('log')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'logging' })
  @Header('Content-Type', 'text/html')
  async log(): Promise<string> {
  const mongoUrl = String(process.env.MONGODB_URL);
  const client = new MongoClient(mongoUrl);

  let logs: any[] = [];

  try {
    await client.connect();
    const db = client.db();           // lấy database từ URL
    const collection = db.collection('logs'); // cau hinh ben logger winston.transports.MongoDB

    // Lấy 100 log mới nhất
    logs = await collection
      .find({})
      .sort({ timestamp: -1 })   // Mới nhất trước
      .limit(100)
      .toArray();
  } catch (err: any) {
    logs = [{ message: 'Cannot read MongoDB logs: ' + err.message, level: 'error' }];
  } finally {
    await client.close();
  }

  // Chuyển logs thành HTML rows
  const logRows = logs.map(log => {
    const ts = log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '';
    const lvl = log.level || '';
    const ctx = log.service || log.context || '';
    const msg = log.message || '';
    const admin = log.admin || '';

    let statusColor = '#e5e5e5';
    let statusBg = 'rgba(229, 229, 229, 0.1)';
    if (lvl.toLowerCase() === 'info') {
      statusColor = '#57ff80';
      statusBg = 'rgba(87, 255, 128, 0.1)';
    } else if (lvl.toLowerCase() === 'warn') {
      statusColor = '#ffd93d';
      statusBg = 'rgba(255, 217, 61, 0.1)';
    } else if (lvl.toLowerCase() === 'error') {
      statusColor = '#ff6b6b';
      statusBg = 'rgba(255, 107, 107, 0.1)';
    }

    return `
      <tr>
        <td class="time-col">${ts}</td>
        <td class="status-col">
          <span class="status-badge" style="color:${statusColor}; background:${statusBg}; border-color:${statusColor}">
            ${lvl.toUpperCase()}
          </span>
        </td>
        <td class="service-col">${ctx}</td>
        <td class="message-col">${msg}</td>
        <td class="admin-col">${admin}</td>
      </tr>
    `;
  }).join('');
    // cách đọc từ file logs
    // const logPath = path.join(process.cwd(), 'logs', 'combined.log');

    // let logs: any[] = [];
    // try {
    //   const data = fs.readFileSync(logPath, 'utf-8');
    //   const lines = data.trim().split('\n');
    //   // Lấy 100 dòng cuối, hiển thị ngược lại (mới nhất lên đầu)
    //   logs = lines.slice(-100).reverse().map(line => {
    //     try {
    //       return JSON.parse(line);
    //     } catch (e) {
    //       return { message: line, level: 'error' }; // log lỗi parse
    //     }
    //   });
    // } catch (err) {
    //   logs = [{ message: 'Cannot read log file: ' + err.message, level: 'error' }];
    // }

    // const logRows = logs.map(log => {
    //   const ts = log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '';
    //   const lvl = log.level || '';
    //   const ctx = log.service || log.context || ''; // Ưu tiên service trước
    //   const msg = log.message || '';
    //   const admin = log.admin || ''; // Lấy admin

    //   // màu theo level
    //   let statusColor = '#e5e5e5';
    //   let statusBg = 'rgba(229, 229, 229, 0.1)';
    //   if (lvl.toLowerCase() === 'info') {
    //     statusColor = '#57ff80';
    //     statusBg = 'rgba(87, 255, 128, 0.1)';
    //   } else if (lvl.toLowerCase() === 'warn') {
    //     statusColor = '#ffd93d';
    //     statusBg = 'rgba(255, 217, 61, 0.1)';
    //   } else if (lvl.toLowerCase() === 'error') {
    //     statusColor = '#ff6b6b';
    //     statusBg = 'rgba(255, 107, 107, 0.1)';
    //   }

    //   return `
    //     <tr>
    //       <td class="time-col">${ts}</td>
    //       <td class="status-col">
    //         <span class="status-badge" style="color:${statusColor}; background:${statusBg}; border-color:${statusColor}">
    //           ${lvl.toUpperCase()}
    //         </span>
    //       </td>
    //       <td class="service-col">${ctx}</td>
    //       <td class="message-col">${msg}</td>
    //       <td class="admin-col">${admin}</td>
    //     </tr>
    //   `;
    // }).join('');

    return `
      <html>
      <head>
        <title>Log Server</title>
        <link rel="icon" type="image/png" href="https://avatarfiles.alphacoders.com/110/110487.png">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: url('https://i.pinimg.com/originals/fd/ea/ff/fdeaff0efe3b9f014f0be734224a5219.png') no-repeat center center;
            background-size: cover;
            padding: 20px;
          }
          .container {
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            padding: 32px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 20px 60px rgba(0,0,0,0.7);
            max-width: 1600px;
            width: 100%;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
          }
          h1 {
            color: #ffffff;
            text-align: center;
            margin-bottom: 24px;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .table-wrapper {
            overflow-y: auto;
            overflow-x: auto;
            flex: 1;
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.25);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            color: #fff;
          }
          thead {
            position: sticky;
            top: 0;
            z-index: 10;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(10px);
          }
          th {
            padding: 16px 20px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #a0a0b0;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          }
          td {
            padding: 14px 20px;
            font-size: 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            vertical-align: top;
          }
          tr:hover {
            background: rgba(255, 255, 255, 0.03);
          }
          .time-col {
            color: #b0b0c0;
            font-size: 14px;
            white-space: nowrap;
            min-width: 160px;
            font-variant-numeric: tabular-nums;
          }
          .status-col {
            min-width: 100px;
          }
          .status-badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.3px;
            border: 1.5px solid;
            text-align: center;
          }
          .service-col {
            color: #90caf9;
            font-weight: 500;
            min-width: 150px;
          }
          .message-col {
            color: #e5e5e5;
            word-break: break-word;
            line-height: 1.5;
          }
          .admin-col {
            color: #ffa726;
            font-weight: 500;
            min-width: 120px;
          }
          /* Scrollbar styling */
          .table-wrapper::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          .table-wrapper::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
          }
          .table-wrapper::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
          }
          .table-wrapper::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
          }
          @media (max-width: 768px) {
            .container {
              padding: 20px;
            }
            h1 {
              font-size: 22px;
            }
            th, td {
              padding: 10px 12px;
              font-size: 13px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Logging Server ( 100 logs )</h1>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Message</th>
                  <th>Admin</th>
                </tr>
              </thead>
              <tbody>
                ${logRows}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  @Get('memory')
  @Header('Content-Type', 'text/html')
  memory() {
    const cpuUsage = (process.cpuUsage().user / 1000000).toFixed(2);
    const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const heapUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const timestamp = new Date().toLocaleString('vi-VN');

    return `
      <html>
      <head>
        <title>System Monitor</title>
        <link rel="icon" type="image/png" href="https://avatarfiles.alphacoders.com/110/110487.png">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: url('https://i.pinimg.com/originals/fd/ea/ff/fdeaff0efe3b9f014f0be734224a5219.png') no-repeat center center;
            background-size: cover;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            padding: 40px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 20px 60px rgba(0,0,0,0.7);
            max-width: 500px;
            width: 100%;
          }
          h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
            color: #ffffff;
          }
          .card { 
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            margin: 15px 0;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          h2 { 
            margin: 0 0 15px 0;
            font-size: 16px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #a0a0b0;
          }
          .bar-container {
            background: rgba(0, 0, 0, 0.4);
            height: 24px;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 10px;
          }
          .bar { 
            height: 100%;
            border-radius: 12px;
            transition: width 0.3s ease;
            background: linear-gradient(90deg, #57ff80 0%, #43a047 100%);
          }
          .value {
            font-size: 20px;
            font-weight: 600;
            color: #57ff80;
          }
          .timestamp {
            text-align: center;
            margin-top: 25px;
            font-size: 14px;
            color: #b0b0c0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>System Monitor</h1>
          
          <div class="card">
            <h2>CPU Usage</h2>
            <div class="bar-container">
              <div class="bar" style="width:${Math.min(parseFloat(cpuUsage), 100)}%"></div>
            </div>
            <p class="value">${cpuUsage}%</p>
          </div>

          <div class="card">
            <h2>Memory Usage</h2>
            <div class="bar-container">
              <div class="bar" style="width:${Math.min((parseFloat(memUsage) / 1024) * 100, 100)}%"></div>
            </div>
            <p class="value">${memUsage} MB</p>
          </div>

          <div class="card">
            <h2>Heap Usage</h2>
            <div class="bar-container">
              <div class="bar" style="width:${Math.min((parseFloat(heapUsage) / 1024) * 100, 100)}%"></div>
            </div>
            <p class="value">${heapUsage} MB</p>
          </div>

          <p class="timestamp">Last updated: ${timestamp}</p>
        </div>
      </body>
      </html>
    `;
  }

  @Get('docs')
  @Header('Content-Type', 'text/html')
  docs() {
    return `
      <!doctype html>
<html lang="vi">
<head>
  <link rel="icon" type="image/png" href="https://avatars.pfptown.com/775/broly-pfp-2999.png">
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Server Tech Docs</title>
  <style>
    /* Minimal trắng / đen chủ đạo, đọc tốt trên desktop và mobile */
    :root{
      --bg:#ffffff;
      --fg:#0b0b0b;
      --muted:#6b6b6b;
      --accent:#111111;
      --panel:#f7f7f7;
      --border:#e6e6e6;
      --code-bg:#0b0b0b;
      --code-fg:#eaeaea;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Helvetica Neue", monospace;
      --radius:10px;
      --gap:18px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
      color:var(--fg);
      background:linear-gradient(180deg, var(--bg), #fbfbfb);
    }
    *{box-sizing:border-box}
    body{margin:0;padding:0;line-height:1.5}
    .app{display:grid;grid-template-columns:320px 1fr;min-height:100vh}
    .sidebar{
      border-right:1px solid var(--border);
      padding:24px;
      background:linear-gradient(180deg,#fff,#fafafa);
      position:sticky;top:0;height:100vh;overflow:auto;
    }
    .brand{font-weight:700;font-size:18px;margin-bottom:18px;color:var(--accent)}
    .nav{list-style:none;padding:0;margin:0;display:block}
    .nav li{margin:8px 0}
    .nav a{
      display:block;padding:10px 12px;border-radius:8px;color:var(--fg);text-decoration:none;
      font-size:14px;border:1px solid transparent;
    }
    .nav a:hover{background:#f0f0f0;border-color:var(--border)}
    .content{padding:32px 48px;overflow:auto}
    header.page-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
    header h1{margin:0;font-size:20px;letter-spacing:0.2px}
    header p{margin:0;color:var(--muted);font-size:13px}
    section.card{background:var(--panel);border-radius:var(--radius);padding:20px;margin-bottom:18px;border:1px solid var(--border)}
    h2{margin-top:0}
    .grid{display:grid;grid-template-columns:1fr 320px;gap:18px}
    .meta{padding:12px;border-left:1px dashed var(--border);color:var(--muted);font-size:13px}
    code, pre{font-family:var(--mono);font-size:13px}
    pre{background:var(--code-bg);color:var(--code-fg);padding:12px;border-radius:8px;overflow:auto}
    .pill{display:inline-block;background:#111;color:#fff;padding:4px 8px;border-radius:999px;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    table th, table td{padding:8px;border-bottom:1px solid var(--border);text-align:left;font-size:13px}
    .small{font-size:13px;color:var(--muted)}
    footer{margin-top:28px;color:var(--muted);font-size:13px}
    /* responsive */
    @media (max-width:980px){
      .app{grid-template-columns:1fr}
      .sidebar{position:relative;height:auto;border-right:none}
      .grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar" aria-label="navigation">
      <div class="brand">Server Backend Docs</div>
      <p class="small">Summary documentation — quick-start, configuration, best practices, security notes.</p>
      <nav>
        <ul class="nav">
          <li><a href="#overview">Architectural overview</a></li>
          <li><a href="#redis">Redis</a></li>
          <li><a href="#rabbitmq">RabbitMQ</a></li>
          <li><a href="#typeorm">TypeORM & Migrations</a></li>
          <li><a href="#postgresql">PostgreSQL</a></li>
          <li><a href="#mysql">MySQL</a></li>
          <li><a href="#mongodb">MongoDB & Mongo Express</a></li>
          <li><a href="#docker">Docker & Docker Desktop</a></li>
          <li><a href="#phpmyadmin-adminer-pgadmin">phpMyAdmin · Adminer · pgAdmin4</a></li>
          <li><a href="#swagger-openai-grpc">Swagger · OpenAI Chatbot · gRPC</a></li>
          <li><a href="#microservice">Microservice patterns</a></li>
          <li><a href="#logging">Logging: Winston · Telegram</a></li>
          <li><a href="#security">Security & Middleware</a></li>
          <li><a href="#ops-monitoring">Ops — rate-limit, monitoring, backups</a></li>
          <li><a href="#appendix">Appendix — commands & snippets</a></li>
          <li><a href="#security-extended">Exception Filter · Health Checks · Passport</a></li>
        </ul>
      </nav>
      <footer>
        <div class="small">Backend By Hai Dang</div>
      </footer>
    </aside>

    <main class="content" id="main">
      <header class="page-head">
        <div>
          <h1>Server Technology Documentation</h1>
          <p class="small">List: Redis, RabbitMQ, TypeORM, migrations, PostgreSQL, MySQL, MongoDB, Mongo Express, Docker, phpMyAdmin, Adminer, pgAdmin4, Swagger, OpenAI Chatbot, gRPC, microservice, logging (Winston, Telegram), plus security techniques.</p>
        </div>
      </header>

      <section id="overview" class="card">
        <h2>Architectural Overview</h2>
        <p class="small">A typical modern backend architecture mix: <strong>API Server (REST/GraphQL)</strong> or <strong>gRPC</strong>, <strong>database</strong> (Postgres/MySQL/MongoDB), <strong>cache</strong> (Redis), <strong>message Broker</strong> (RabbitMQ), and <strong>containerization</strong> (Docker). Logging and monitoring should be developed centrally. Cross-cutting concerns: authentication (JWT, sessions), authorization (roles, guards), input validation (pipes), rate limiting, CORS, secure headers (Helmet), 2FA for sensitive actions.</p>
        <p class="small"><strong>Some of the updated technologies and applications (mentioned) in this document may not be used in the project yet, but will be applied soon.</strong></p>
        <div class="grid" style="margin-top:12px">
          <div>
            <h3>Sample architecture</h3>
            <ol>
              <li>Client (web / mobile) → API Gateway (rate-limit, auth) → REST / gRPC endpoints.</li>
              <li>Stateless app servers: business logic (scale horizontally).</li>
              <li>Data tier: Primary DB (Postgres / MySQL) + Secondary DB (MongoDB for document data).</li>
              <li>Cache: Redis (session, cache, rate-limit counters).</li>
              <li>Message broker: RabbitMQ (asynchronous tasks, events).</li>
              <li>Side services: Mailer, OpenAI Chatbot integration, monitoring, admin tools (pgAdmin, phpMyAdmin, Adminer).</li>
            </ol>
          </div>
          <aside class="meta">
            <strong>Design principles</strong>
            <ul>
              <li>Keep services stateless where possible.</li>
              <li>Use message broker for eventual consistency and background jobs.</li>
              <li>Isolate admin tooling to private network or VPN.</li>
              <li>Automate DB migrations.</li>
              <li>Use TLS everywhere (internal + external).</li>
            </ul>
          </aside>
        </div>
      </section>

      <!-- Redis -->
      <section id="redis" class="card">
        <h2>Redis</h2>
        <p>In-memory data store — cache, session store, distributed locks, rate limiting counters, pub/sub.</p>
        <h4>Use cases</h4>
        <ul>
          <li>Cache frequently-read DB queries</li>
          <li>Session storage (with expiry)</li>
          <li>Rate limiting (sliding window, token bucket)</li>
          <li>Distributed lock (RedLock) for critical sections</li>
          <li>Pub/Sub for lightweight notifications</li>
        </ul>

        <h4>Quick-start (Docker)</h4>
        <pre>docker run -d --name redis -p 6379:6379 redis</pre>

        <h4>Production tips</h4>
        <ul>
          <li>Enable AOF or RDB persistence depending on durability needs.</li>
          <li>Use Redis cluster for horizontal scaling and HA.</li>
          <li>Protect with AUTH and network-level firewall / VPC.</li>
          <li>Monitor memory usage — Redis is memory-bound.</li>
          <li>Use TTLs for cache keys; avoid unlimited growth.</li>
        </ul>
      </section>

      <!-- RabbitMQ -->
      <section id="rabbitmq" class="card">
        <h2>RabbitMQ</h2>
        <p>Message broker — reliable messaging, queues, routing, worker pools.</p>
        <h4>Use cases</h4>
        <ul>
          <li>Background processing (email, reports, image processing)</li>
          <li>Event-driven microservices (commands/events)</li>
          <li>Task distribution to worker pools</li>
        </ul>

        <h4>Quick-start (Docker)</h4>
        <pre>docker run -d --hostname my-rabbit --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management</pre>
        <p class="small">Management UI available on port 15672.</p>

        <h4>Best practices</h4>
        <ul>
          <li>Design idempotent consumers</li>
          <li>Use persistent messages and durable queues if persistence required</li>
          <li>Use dead-letter exchanges (DLX) for failed messages</li>
          <li>Monitor queue length & consumer lag</li>
        </ul>
      </section>

      <!-- TypeORM -->
      <section id="typeorm" class="card">
        <h2>TypeORM & Migrations</h2>
        <p>ORM cho Node.js / TypeScript — mapping entities -> relational DB.</p>

        <h4>Why use TypeORM</h4>
        <ul>
          <li>Entity-based models (decorators)</li>
          <li>Support for Postgres / MySQL / SQLite / MSSQL</li>
          <li>Built-in migration generation</li>
        </ul>

        <h4>Migrations</h4>
        <p class="small">Luôn dùng migration để thay đổi schema trong production; không dùng synchronize: true</p>
        <pre>
// init
npx typeorm migration:generate -n AddUsersTable
// run
npx typeorm migration:run
        </pre>

        <h4>Tips</h4>
        <ul>
          <li>Disable synchronize in production; prefer explicit migrations.</li>
          <li>Keep entities small and cohesive.</li>
          <li>Use queryRunner for complex migration steps.</li>
        </ul>
      </section>

      <!-- PostgreSQL -->
      <section id="postgresql" class="card">
        <h2>PostgreSQL</h2>
        <p>Relational DB — transactional workloads, strong SQL features, indexes, JSONB.</p>

        <h4>Quick-start (Docker)</h4>
        <pre>docker run -d --name postgres -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:15</pre>

        <h4>Best practices</h4>
        <ul>
          <li>Use connection pooling (PgBouncer) for high concurrency.</li>
          <li>Design indexes based on query patterns (btree, gin for JSONB)</li>
          <li>Back up regularly (pg_dump / WAL shipping)</li>
          <li>Use roles & least-privilege for DB users</li>
        </ul>
      </section>

      <!-- MySQL -->
      <section id="mysql" class="card">
        <h2>MySQL</h2>
        <p>Relational DB — widespread, performant for many workloads.</p>

        <h4>Quick-start (Docker)</h4>
        <pre>docker run -d --name mysql -e MYSQL_ROOT_PASSWORD=pass -p 3306:3306 mysql:8</pre>

        <h4>Best practices</h4>
        <ul>
          <li>Use proper charset/collation (utf8mb4 / utf8mb4_unicode_ci)</li>
          <li>Monitor slow queries, use EXPLAIN</li>
          <li>Use replication for read scaling and backups</li>
        </ul>
      </section>

      <!-- MongoDB -->
      <section id="mongodb" class="card">
        <h2>MongoDB & Mongo Express</h2>
        <p>Document database — flexible schema, good for logs, events, JSON-like data.</p>

        <h4>Quick-start (Docker)</h4>
        <pre>docker run -d --name mongodb -p 27017:27017 mongo:6</pre>
        <pre>docker run -d --name mongo-express -p 8081:8081 -e ME_CONFIG_MONGODB_SERVER=mongodb mongo-express</pre>

        <h4>When to use</h4>
        <ul>
          <li>Schemaless collections, rapid iteration</li>
          <li>Time series, event storage, caching-like stores</li>
        </ul>

        <h4>Production tips</h4>
        <ul>
          <li>Use replica set for HA</li>
          <li>Enable authentication and role-based access</li>
          <li>Monitor storage size and indexing (avoid unbounded collections)</li>
        </ul>
      </section>

      <!-- Docker -->
      <section id="docker" class="card">
        <h2>Docker & Docker Desktop</h2>
        <p>Containerization for packaging services. Docker Desktop for dev machines.</p>

        <h4>Core practices</h4>
        <ul>
          <li>Build small images (multi-stage build)</li>
          <li>Avoid storing secrets in images — use environment variables / secret managers</li>
          <li>Use docker-compose for local multi-service stacks</li>
        </ul>

        <h4>Example docker-compose.yml (snippet)</h4>
        <pre>
version: '3.8'
services:
  mysql-nro:
    image: mysql:8.0
    container_name: mysql-nro
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: "pass"
    volumes:
      - ./configAdmin.sql:/docker-entrypoint-initdb.d/configAdmin.sql

  phpmyadmin:
    image: phpmyadmin/phpmyadmin
    container_name: phpmyadmin
    ports:
      - "8081:80"
    environment:
      PMA_HOST: mysql-nro
    depends_on:
      - mysql-nro
        </pre>

        <h4>Docker Desktop notes</h4>
        <ul>
          <li>Enable Kubernetes locally if you need to test k8s manifests</li>
          <li>Use the built-in dashboard for container inspection</li>
        </ul>
      </section>

      <!-- Admin Tools -->
      <section id="phpmyadmin-adminer-pgadmin" class="card">
        <h2>Admin Tools: phpMyAdmin · Adminer · pgAdmin4</h2>
        <p>Quick DB admin UIs for MySQL/Postgres. Keep them restricted to internal network or VPN.</p>
        <ul>
          <li><strong>phpMyAdmin:</strong> popular for MySQL/MariaDB. Docker: <code>phpmyadmin/phpmyadmin</code></li>
          <li><strong>Adminer:</strong> lightweight single-file DB admin (supports many DBs). Docker: <code>adminer</code></li>
          <li><strong>pgAdmin4:</strong> full-featured Postgres GUI. Docker: <code>dpage/pgadmin4</code></li>
        </ul>
        <p class="small">Do NOT expose these tools publicly without auth & network protection.</p>
      </section>

      <!-- Swagger & OpenAI -->
      <section id="swagger-openai-grpc" class="card">
        <h2>Swagger · OpenAI Chatbot · gRPC</h2>

        <h4>Swagger / OpenAPI</h4>
        <p>Document REST API endpoints; auto-generate client SDKs; include securitySchemes for JWT.</p>
        <pre>// Example: Using swagger-jsdoc + swagger-ui-express in Node
const swaggerUi = require('swagger-ui-express');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
        </pre>

        <h4>OpenAI Chatbot Integration</h4>
        <p>Use server-side proxy to call OpenAI APIs — never embed API keys in frontend. Validate & sanitize user input, rate-limit requests, and monitor usage for cost control.</p>

        <h4>gRPC</h4>
        <p>Use gRPC for high-performance RPC between microservices. Advantages: typed contracts (proto), streaming, low-latency. Consider using gRPC gateway if exposing HTTP/JSON endpoints to clients.</p>

        <h4>Notes</h4>
        <ul>
          <li>Use TLS for gRPC in production.</li>
          <li>Version your proto definitions and keep backward compatibility rules.</li>
        </ul>
      </section>

      <!-- Microservice -->
      <section id="microservice" class="card">
        <h2>Microservice patterns</h2>
        <p>Common patterns for scalable backend systems.</p>
        <h4>Communication</h4>
        <ul>
          <li>Sync: REST / gRPC for request-response</li>
          <li>Async: Message broker (RabbitMQ, Kafka) for events</li>
        </ul>
        <h4>Data consistency</h4>
        <ul>
          <li>Use event sourcing or eventual consistency where needed</li>
          <li>Compensating transactions for distributed operations</li>
        </ul>
        <h4>Service discovery & orchestration</h4>
        <ul>
          <li>Kubernetes for orchestration</li>
          <li>Use sidecar patterns for logging/monitoring where appropriate</li>
        </ul>
      </section>

      <!-- Logging -->
      <section id="logging" class="card">
        <h2>Logging: Winston & Telegram notifications</h2>
        <p>Structured logging is essential. Use JSON logs in production for easy ingestion into ELK / Loki / Datadog.</p>

        <h4>Winston (Node.js)</h4>
        <pre>
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    // file, remote transports...
  ],
});
        </pre>

        <h4>Telegram alerting</h4>
        <p>Use Telegram bot to send critical alerts (service down, high error rate). Keep alerting rate-limited and only for critical incidents.</p>

        <h4>Best practices</h4>
        <ul>
          <li>Separate levels: debug / info / warn / error / critical</li>
          <li>Attach correlation IDs / request IDs to logs for traceability</li>
          <li>Ship logs to central system (ELK / Loki / Cloud provider)</li>
        </ul>
      </section>

      <!-- Security & Middleware -->
      <section id="security" class="card">
        <h2>Security & Middleware</h2>

        <h4>JWT Authentication</h4>
        <p>JWT is convenient for stateless auth. Use short-lived access tokens + refresh tokens stored securely. Always verify signature and token expiry.</p>

        <h4>Roles & Guards</h4>
        <p>Implement role-based access control (RBAC) at the route/handler level. In frameworks like NestJS, use Guards to enforce permissions.</p>

        <h4>2FA</h4>
        <p>Two Factor Authentication (TOTP or SMS). Use TOTP apps (Google Authenticator) or WebAuthn for stronger security.</p>

        <h4>Validation pipes</h4>
        <p>Validate and sanitize all incoming data (reject unknown properties). Prevents injection and malformed requests.</p>

        <h4>CORS</h4>
        <p>Configure CORS to allow only trusted origins; avoid wildcard '*' in production.</p>

        <h4>Helmet</h4>
        <p>Set secure HTTP headers (X-Frame-Options, Content-Security-Policy, X-XSS-Protection, etc.).</p>

        <h4>Rate limiting</h4>
        <p>Protect public endpoints with API rate limits (per IP / per API key). Use Redis for distributed counters.</p>

        <h4>Send mail</h4>
        <p>Use transactional email providers (SendGrid, Mailgun) or SMTP with authenticated credentials. Queue emails via RabbitMQ for reliability.</p>

        <h4>Other notes</h4>
        <ul>
          <li>Store secrets in a secret manager (Vault, cloud secrets) — not in source or images.</li>
          <li>Use TLS everywhere. Rotate keys regularly.</li>
        </ul>
      </section>

      <!-- Ops / Monitoring -->
      <section id="ops-monitoring" class="card">
        <h2>Ops — rate-limit, monitoring, backups, healthchecks</h2>
        <h4>Monitoring</h4>
        <ul>
          <li>Metrics (Prometheus) + dashboards (Grafana)</li>
          <li>Log aggregation (ELK / Loki)</li>
          <li>APM (Datadog, NewRelic, OpenTelemetry)</li>
        </ul>

        <h4>Backups</h4>
        <ul>
          <li>Automated DB backups (daily) and WAL archiving for Postgres</li>
          <li>Test restore procedures regularly</li>
        </ul>

        <h4>Healthchecks & readiness</h4>
        <p>Expose /health and /ready endpoints for orchestration (k8s liveness/readiness). Use graceful shutdown to avoid dropped jobs.</p>
      </section>

      <!-- Appendix -->
      <section id="appendix" class="card">
        <h2>Appendix — commands, snippets, checklists</h2>

        <h4>Docker: common commands</h4>
        <pre>
# build & up
docker-compose build
docker-compose up -d

# inspect logs
docker-compose logs -f service-name

# remove unused
docker system prune
        </pre>

        <h4>TypeORM migration checklist</h4>
        <ol>
          <li>Generate migration locally and review SQL</li>
          <li>Run migration in staging</li>
          <li>Back up prod DB before applying</li>
          <li>Apply during maintenance window if risky</li>
        </ol>

        <h4>Security checklist before production</h4>
        <ul>
          <li>HTTPS enabled, HSTS</li>
          <li>Secrets in secret manager</li>
          <li>Admin tools not publicly accessible</li>
          <li>Alerting + runbooks prepared</li>
        </ul>
      </section>
            <!-- SECURITY / AUTH / EXCEPTION / HEALTHCHECK -->
      <section id="security-extended" class="card">
        <h2>Exception Filter · Health Checks · Passport (Auth)</h2>

        <h3>1. Global Exception Filter</h3>
        <p>Centralized error handling — standardized responses for all APIs.</p>
        <pre>
// NestJS example
export function grpcToHttp(code: number | null) {
  switch (code) {
    case grpcStatus.UNAUTHENTICATED: return 401;
    case grpcStatus.PERMISSION_DENIED: return 403;
    case grpcStatus.NOT_FOUND: return 404;
    case grpcStatus.ALREADY_EXISTS: return 409;
    case grpcStatus.RESOURCE_EXHAUSTED: return 429;
    default: return 500;
  }
}
        </pre>

        <h3>2. Health Checks (Terminus)</h3>
        <p>Temporarily unavailable.</p>
        <pre>
// Register in app module
@Get('health')
check() {
  return this.health.check([
    () => this.db.pingCheck('database'),
    () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
  ]);
}
        </pre>

        <h3>3. Passport (Authentication)</h3>
        <p>Temporarily unavailable.</p>
        <pre>
// Example local strategy
@Injectable()
export class LocalStrategy extends Strategy {
  constructor(private readonly authService: AuthService) {
    super();
  }
  async validate(username: string, password: string) {
    return await this.authService.validateUser(username, password);
  }
}
        </pre>

        <p>JWT guard:</p>
        <pre>
@UseGuards(AuthGuard('jwt'))
        </pre>
      </section>

      <!-- DB TRANSACTION / LOCK -->
      <section id="transaction-lock" class="card">
        <h2>Transaction Code · Lock Row DB</h2>

        <h3>1. Transaction TypeORM</h3>
        <pre>
await this.dataSource.transaction(async (manager) => {
  const user = await manager.save(User, { name: 'John' });
  await manager.save(Profile, { userId: user.id });
});
        </pre>

        <h3>2. Row-Level Lock (Pessimistic Lock)</h3>
        <p>Used when updating highly competitive resources (balance, stock,...).</p>
        <pre>
await manager
  .createQueryBuilder(User, 'u')
  .useTransaction(true)
  .setLock('pessimistic_write')
  .where('u.id = :id', { id })
  .getOne();
        </pre>

        <p>Application:</p>
        <ul>
          <li>Avoid race-conditions when transferring money</li>
          <li>Ensure update order when running workers in parallel</li>
          <li>Protect shared resources</li>
        </ul>
      </section>

      <!-- REDIS INSIGHT -->
      <section id="redis-insight" class="card">
        <h2>Redis Insight</h2>
        <p>Official GUI from Redis — view locks, TTL, memory, latency, pub/sub, streams.</p>

        <h4>Docker (quick-start)</h4>
        <pre>
docker run -d \
  --name redis-insight \
  -p 8001:8001 \
  redis/redisinsight:latest
        </pre>

      <h4> Highlights</h4>
      <ul>
        <li>Tree Browser Lock</li>
        <li>Live Editor for Hash · List · Set · ZSet</li>
        <li>Performance Dashboard</li>
        <li>Real-time Command Monitoring</li>
      </ul>
      </section>

      <!-- JAEGER -->
      <section id="jaeger" class="card">
        <h2>Jaeger Distributed Tracing</h2>
        <p>Used to trace requests between microservices; find bottlenecks, delays, retry loops.</p>

        <h4>Docker All-in-One</h4>
        <pre>
docker run -d --name jaeger \
  -e COLLECTOR_ZIPKIN_HTTP_PORT=9411 \
  -p 5775:5775/udp \
  -p 6831:6831/udp \
  -p 6832:6832/udp \
  -p 5778:5778 \
  -p 16686:16686 \
  -p 14268:14268 \
  -p 14250:14250 \
  -p 9411:9411 \
  jaegertracing/all-in-one
        </pre>

      <h4>Key Benefits</h4>
      <ul>
        <li>View the entire request path</li>
        <li>Identify slow services (hot paths)</li>
        <li>Optimize retry/backoff</li>
        <li>Monitor error rates by service</li>
      </ul>
      </section>


      <footer style="margin-top:18px">
        <div class="small">© Backend by Hai Dang - 2025</div>
      </footer>
    </main>
  </div>
</body>
</html>

    `;
  }
}
