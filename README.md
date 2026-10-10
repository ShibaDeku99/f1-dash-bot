# F1 Dash Discord Bot 🏎️

Bot Discord Formula 1 trực tiếp (real-time) hoàn toàn độc lập (**Standalone**), kết nối trực tiếp vào hệ thống Live Timing chính thức của F1 qua giao thức SignalR Core và lịch đua chính thức.

> [!NOTE]
> **Hoàn toàn độc lập:** Không cần Docker, không cần cài Rust, không cần chạy service backend trung gian. Bot chạy thuần túy bằng Node.js và chỉ tốn ~50MB RAM (hoàn hảo cho VPS 1GB - 2GB RAM).

---

## 🌟 Tính năng

### 🔔 Auto Notifications (Thông báo tự động)
| Thông báo | Kênh Discord | Mô tả |
|---|---|---|
| **Race Control Alerts** | `#race-control` | Cờ vàng, cờ đỏ, Safety Car, VSC, án phạt, điều tra |
| **Fastest Lap** | `#race-control` | Cập nhật tay đua lập fastest lap mới |
| **Pit Stop** | `#race-control` | Nhận diện tay đua vào pit và lốp mới sau pit |
| **Team Radio** | `#team-radio` | Đoạn voice radio của tay đua kèm link audio nghe trực tiếp |
| **Session Start/End** | `#session-alerts` | Trạng thái bắt đầu / kết thúc chặng đua |
| **Pre-Race Reminder** | `#session-alerts` | Nhắc lịch đua trước 1 tiếng và 30 phút (@here) |

### ⌨️ Slash Commands (Lệnh điều khiển)
| Lệnh | Mô tả |
|---|---|
| `/leaderboard` | Bảng xếp hạng trực tiếp với khoảng cách (gap), thời gian vòng, số lần pit |
| `/driver <tla>` | Chi tiết telemetry và lốp của tay đua (VD: `/driver VER`) |
| `/tire` | Thống kê loại lốp hiện tại của toàn bộ 20 tay đua |
| `/top3` | Xem nhanh top 3 tay đua dẫn đầu |
| `/session` | Thông tin chặng đua, số vòng đua (lap count), thời gian còn lại |
| `/weather` | Điều kiện thời tiết: nhiệt độ đường đua, nhiệt độ không khí, mưa |
| `/track-status` | Trạng thái cờ và đường đua hiện tại |
| `/championship` | Dự đoán điểm số và thứ hạng vô địch tay đua & đội đua |
| `/next-race` | Xem chặng đua tiếp theo, lịch các phiên chạy và đếm ngược |
| `/schedule` | Xem toàn bộ lịch thi đấu F1 mùa giải hiện tại |
| `/status` | Kiểm tra kết nối trực tiếp đến F1 Live Timing |

### 📺 Live Leaderboard Channel
Tự động ghim 1 tin nhắn duy nhất trong kênh được chỉ định và tự động cập nhật mỗi **30 giây** trong suốt phiên đua (hiển thị emoji lốp, gap, số pit).

---

## 🚀 Cài đặt & Khởi động

### 1. Yêu cầu
- **Node.js**: v18 trở lên (đã test mượt mà trên Node.js v24)
- **Token Discord Bot**: Tạo tại [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Cài đặt thư viện
```bash
cd f1-dash-bot
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```
Điền thông tin vào `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# (Tùy chọn) ID server Discord để deploy lệnh tức thì trong lúc dev
DISCORD_GUILD_ID=your_guild_id_here

# ID các kênh để bot tự động gửi thông báo (Chuột phải vào kênh Discord -> Copy Channel ID)
RACE_CONTROL_CHANNEL_ID=your_channel_id_here
LIVE_LEADERBOARD_CHANNEL_ID=your_channel_id_here
TEAM_RADIO_CHANNEL_ID=your_channel_id_here
SESSION_ALERT_CHANNEL_ID=your_channel_id_here
```

### 4. Đăng ký Slash Commands với Discord
```bash
npm run deploy
```

### 5. Khởi động bot
```bash
npm start
```
Hoặc chế độ dev (tự reload khi sửa code):
```bash
npm run dev
```

---

## 🏛️ Kiến trúc hoạt động

```
F1 Official Live Timing (SignalR Core)  ── WebSocket ──┐
                                                       ├─→ [ f1-dash-bot (Node.js) ] ──→ Discord API
Official F1 Calendar (ICS Feed)         ── HTTP/REST ──┘        (~50MB RAM)
```
- **Không cần Docker**
- **Không cần Rust / Cargo**
- **Chạy trực tiếp 1 tiến trình duy nhất**
