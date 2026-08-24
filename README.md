<p align="center">
  <img src="https://i.pinimg.com/originals/fd/91/b1/fd91b1715061efc79dbb6678aea0f9b9.gif" width="220" alt="Ngọc Rồng Online">
</p>

<h1 align="center">Chú Bé Rồng Online</h1>

<p align="center">
  <em>Java Multiplayer MMORPG · Microservice Architecture · Real-time Combat</em>
</p>

<p align="center">
  <a href="https://www.java.com/"><img src="https://img.shields.io/badge/Java-17+-ED8B00?style=flat&logo=openjdk&logoColor=white" alt="Java"/></a>
  <a href="https://libgdx.com/"><img src="https://img.shields.io/badge/LibGDX-1.12+-E74C3C?style=flat&logo=libgdx&logoColor=white" alt="LibGDX"/></a>
  <a href="https://gradle.org/"><img src="https://img.shields.io/badge/Gradle-8+-02303A?style=flat&logo=gradle&logoColor=white" alt="Gradle"/></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-10+-E0234E?style=flat&logo=nestjs&logoColor=white" alt="NestJS"/></a>
  <a href="https://golang.org/"><img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go&logoColor=white" alt="Go"/></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript"/></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"/></a>
  <a href="https://github.com/DANG-PH/MICROSERVICE_GAME_SERVICE_GO/stargazers"><img src="https://img.shields.io/github/stars/DANG-PH/MICROSERVICE_GAME_SERVICE_GO?style=flat&color=yellow" alt="Stars"/></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/></a>
  <a href="https://goreportcard.com/report/github.com/DANG-PH/MICROSERVICE_GAME_SERVICE_GO"><img src="https://goreportcard.com/badge/github.com/DANG-PH/MICROSERVICE_GAME_SERVICE_GO?v=2" alt="Go Report Card"/></a>
</p>

<p align="center">
  Dự án cá nhân tái hiện <strong>Ngọc Rồng Online</strong> – tựa game MMORPG gắn liền với tuổi thơ của hàng triệu game thủ Việt,<br>
  lấy cảm hứng từ bộ truyện tranh huyền thoại <strong>Dragon Ball (7 Viên Ngọc Rồng)</strong> của tác giả Akira Toriyama.
</p>

<p align="center">
  <a href="https://ngocrongdark.com">
    <img src="https://img.shields.io/badge/▶_CHƠI_NGAY-ngocrongdark.com-FF6B35?style=for-the-badge&logoColor=white" alt="Play Now"/>
  </a>
  &nbsp;
  <a href="https://github.com/DANG-PH/NgocRongOnline/releases">
    <img src="https://img.shields.io/badge/⬇_TẢI_VỀ-Latest_Release-181717?style=for-the-badge&logo=github&logoColor=white" alt="Download"/>
  </a>
</p>

---

## Về dự án

Sau khoảng **1 năm phát triển**, mình đã ra mắt phiên bản playable đầu tiên của game đa người chơi lấy cảm hứng từ Dragon Ball, hiện đang chạy trên **PC (Windows)**. Dự án tập trung vào việc xây dựng **hệ thống multiplayer thời gian thực** và **kiến trúc backend từ đầu**, không sử dụng game engine có sẵn cho phần logic server.

Đây không chỉ là một bản tái hiện về mặt gameplay mà còn là **bài thực hành kiến trúc microservice** với 3 stack công nghệ khác nhau (Java/LibGDX, NestJS, Golang), mô phỏng cách các tựa game online thương mại được xây dựng trong thực tế. Game vẫn đang trong quá trình hoàn thiện — sửa lỗi, tối ưu hiệu năng và bổ sung tính năng mới — và mình rất mong nhận được góp ý từ cộng đồng.

---

## Tính năng hiện có

### 🌐 Real-time Multiplayer
- **Đồng bộ thời gian thực**: người chơi nhìn thấy nhau, tương tác và quan sát hành động (di chuyển, kỹ năng) trên cùng bản đồ
- **Hệ thống giao dịch (trade)** giữa người chơi với xác thực 2 phía
- **NPC Shop** mua bán vật phẩm
- **Cường hóa item** qua NPC
- **Mini-game** trong thế giới game

### 🎒 Game Systems
- **Inventory persistence** — hành trang được lưu trữ liên tục, đồng bộ giữa client và server
- **Hệ thống đệ tử** và cơ chế **fusion** (hợp thể)
- **Triệu hồi rồng thần** sau khi thu thập đủ 7 viên ngọc rồng
- **Vòng quay may mắn** với **pity system** (đảm bảo nhận thưởng sau số lần quay nhất định)
- **Hệ thống Giftcode** — phát mã quà tặng cho người chơi

### 🛠️ Web Platform & Admin Tools
- **Dashboard quản lý người chơi** — xem, tìm kiếm, thao tác trên tài khoản
- **Inventory tracking** — theo dõi vật phẩm của từng người chơi
- **Thao tác thủ công vàng/vật phẩm** — admin có thể cộng/trừ tài nguyên khi cần (xử lý khiếu nại, sự kiện)
- **Hệ thống tin tức (news)** — đăng tải thông báo trong game và trên web
- **Tích hợp chatbot** — hỗ trợ người chơi tự động

### 💳 Payment Integration
- **Tích hợp PayOS** cho nạp tiền online
- **Giao tài nguyên tự động và nhất quán** vào game ngay sau khi thanh toán thành công
- Đảm bảo **idempotency** — không bị giao trùng hoặc thiếu khi có lỗi mạng

### ⚙️ Backend & Infrastructure
- **Server chạy 24/7**, đã deploy lên môi trường thật
- **Tách biệt môi trường** dev và production
- **Hỗ trợ nhiều người chơi đồng thời**

## Production

| | |
|---|---|
| 🎮 Game & Web | [ngocrongdark.com](https://ngocrongdark.com) |
| 🔌 API Gateway | [api.ngocrongdark.com](https://api.ngocrongdark.com) |
| 📦 Game Releases | [download.ngocrongdark.com](https://download.ngocrongdark.com) |
| 🗄️ Database Hub | [data.ngocrongdark.com](https://data.ngocrongdark.com) |
| 📊 Redis Monitor | [redis.ngocrongdark.com](https://redis.ngocrongdark.com) |

## Repositories

**Client**

| Repo | Mô tả |
|---|---|
| [dragonboy-web](https://github.com/DANG-PH/dragonboy-web) | Web platform Next.js cho người chơi — item shop, account market, leaderboard, real-time chat, ví PayOS, và RAG chatbot AI. |
| [ngoc-rong-online](https://github.com/DANG-PH/ngoc-rong-online) | Game MMORPG LibGDX/Java — multiplayer real-time, giao dịch vật phẩm, nạp thẻ, tái hiện Ngọc Rồng gốc. |

**Server — NestJS (11 services)**

| Repo | Mô tả |
|---|---|
| [dragonboy-api-gateway](https://github.com/DANG-PH/dragonboy-api-gateway) | Cổng vào duy nhất của hệ thống — routing, auth middleware, rate limiting, observability, bảo mật tầng application. |
| [dragonboy-auth-service](https://github.com/DANG-PH/dragonboy-auth-service) | Xác thực người dùng — OTP 2FA, Google OAuth, JWT refresh, token versioning, admin user control. |
| [dragonboy-user-service](https://github.com/DANG-PH/dragonboy-user-service) | Quản lý player — profile, game state, in-game economy (gold & gems), inventory, leaderboard. |
| [dragonboy-game-service](https://github.com/DANG-PH/dragonboy-game-service) | Business logic game phức tạp, stateful game events, phối hợp với Go service xử lý real-time. |
| [dragonboy-game-data-service](https://github.com/DANG-PH/dragonboy-game-data-service) | Master data tĩnh của game — maps, NPCs, item definitions, NPC shops. Source of truth cho toàn hệ thống. |
| [dragonboy-item-service](https://github.com/DANG-PH/dragonboy-item-service) | Quản lý inventory — CRUD vật phẩm, bulk insert, UUID lookup, item swap, database indexing tối ưu. |
| [dragonboy-pay-service](https://github.com/DANG-PH/dragonboy-pay-service) | Ví người chơi — nạp tiền QR (PayOS), idempotency-safe balance, lịch sử giao dịch, analytics admin. |
| [dragonboy-social-network-service](https://github.com/DANG-PH/dragonboy-social-network-service) | Mạng xã hội trong game — bạn bè, chat riêng, group, comment thread, like, thông báo realtime. |
| [dragonboy-queue-service](https://github.com/DANG-PH/dragonboy-queue-service) | Xử lý async qua RabbitMQ — gửi email, bulk mail, item sync/swap, retry logic, horizontal scaling. |
| [dragonboy-disciple-service](https://github.com/DANG-PH/dragonboy-disciple-service) | Hệ thống đệ tử — tạo đệ tử, theo dõi sức mạnh, lưu trạng thái game theo player. |
| [dragonboy-admin-service](https://github.com/DANG-PH/dragonboy-admin-service) | Vận hành nội bộ — phân quyền RBAC (editor/cashier/marketplace), tài chính, partner workflows. |

**Server — Golang (1 service)**

| Repo | Mô tả |
|---|---|
| [dragonboy-game-service-go](https://github.com/DANG-PH/dragonboy-game-service-go) | Real-time game server hiệu năng cao — raw WebSocket, custom binary protocol, NATS pub/sub, tick processing độ trễ thấp. |

**Infra / DevOps (2 services)**

| Repo | Mô tả |
|---|---|
| [dragonboy-devops-service](https://github.com/DANG-PH/dragonboy-devops-service) | CI/CD hub trung tâm — nhận trigger từ 14 services, orchestrate deploy tự động lên 3 VPS riêng biệt. |
| [dragonboy-nginx-service](https://github.com/DANG-PH/dragonboy-nginx-service) | Nginx stack — load balancer, reverse proxy, SSL termination, Docker Compose trên dedicated VPS. |

## 🤝 Đóng góp

Game vẫn đang trong giai đoạn hoàn thiện và mình rất mong nhận được góp ý từ cộng đồng. Mọi đóng góp đều được chào đón!

1. **Fork** repository này
2. Tạo branch mới: `git checkout -b feature/ten-tinh-nang`
3. Commit theo chuẩn [Conventional Commits](https://www.conventionalcommits.org/): `feat: them he thong cuong hoa`
4. Push lên fork và mở **Pull Request**

Trước khi làm tính năng lớn, vui lòng mở **Issue** để thảo luận trước — tránh trùng lặp công sức.

Bạn cũng có thể đóng góp bằng cách **báo bug** hoặc **đề xuất tính năng** qua tab Issues — mọi feedback đều quý giá với mình.

---

## 📜 License

Dự án phát hành dưới giấy phép [MIT License](LICENSE) — bạn được tự do sử dụng, chỉnh sửa, phân phối với điều kiện giữ lại copyright notice. **Lưu ý**: dự án này là **fan-made**, không liên quan đến Hiker Games hay bất kỳ chủ sở hữu thương mại nào của Ngọc Rồng Online. Chỉ dùng cho mục đích **học tập và nghiên cứu**.

---

<p align="center">
  💥 Cảm ơn bạn đã quan tâm đến dự án Ngọc Rồng Online 💥
</p>

<p align="center">
  Nếu thấy hữu ích, hãy cho repo một ⭐ để ủng hộ mình nhé!
</p>

<p align="center">
  🎮 <a href="https://ngocrongdark.com">Chơi ngay tại ngocrongdark.com</a>
</p>

<p align="center">
  <a href="https://github.com/DANG-PH">👉 Xem thêm các dự án khác trên GitHub</a>
</p>