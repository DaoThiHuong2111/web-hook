# Next.js Webhook CI Server

Webhook server tự động cho CI/CD pipeline của dự án Next.js sử dụng Express.js và Docker.

## Tính năng

- ✅ Nhận GitHub webhook khi tạo tag
- ✅ Kiểm tra tag có từ staging branch không
- ✅ Tự động pull code mới nhất
- ✅ Build Docker image sử dụng Dockerfile có sẵn
- ✅ Upload image lên Docker Hub
- ✅ Tự động chạy container mới

## Cài đặt

### 1. Clone và setup

```bash
git clone <repo-url>
cd web-hook
./setup.sh
```

### 2. Cấu hình Environment

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
# Server Configuration
PORT=3120

# Port Configuration for Docker Deployment
HOST_PORT=3121
CONTAINER_PORT=3122

# GitHub Webhook Configuration
WEBHOOK_SECRET=your-github-webhook-secret

# GitHub Repository
REPO_URL=https://github.com/your-username/your-nextjs-repo.git

# Project Directory
PROJECT_DIR=/var/www/nextjs-project

# Docker Hub Configuration
DOCKER_USERNAME=your-dockerhub-username
DOCKER_PASSWORD=your-dockerhub-password
DOCKER_REPO=your-dockerhub-username/your-app-name
```

### 3. Cài đặt dependencies

```bash
npm install
```

### 4. Chạy server

```bash
# Development
npm run dev

# Production
npm start
```

## Cấu hình GitHub Webhook

1. Vào GitHub repository → Settings → Webhooks
2. Add webhook với URL: `http://your-server:3120/webhook`
3. Content type: `application/json`
4. Secret: Giống với `WEBHOOK_SECRET` trong `.env`
5. Events: Chọn "Create" (for tags)

## Quy trình hoạt động

1. **Nhận webhook**: Server nhận thông báo khi có tag mới được tạo
2. **Kiểm tra branch**: Xác minh tag có được tạo từ `staging` branch không
3. **Pull code**: Tự động pull code mới nhất từ repository
4. **Build Docker**: Sử dụng Dockerfile có sẵn để build image
5. **Push Docker Hub**: Upload image lên Docker Hub
6. **Deploy**: Chạy container mới từ image vừa upload

## API Endpoints

- `POST /webhook` - GitHub webhook endpoint
- `GET /health` - Health check endpoint

## Yêu cầu hệ thống

- Node.js >= 16
- Docker
- Git
- Quyền truy cập Docker Hub

## Lưu ý bảo mật

- Luôn sử dụng HTTPS cho webhook URL trong production
- Bảo mật file `.env` và không commit vào git
- Sử dụng token thay vì password cho Docker Hub khi có thể
- Định kỳ rotate webhook secret

## Troubleshooting

### Kiểm tra logs
```bash
# Xem logs của container đang chạy
docker logs <container-name>

# Xem logs của webhook server
npm run dev
```

### Kiểm tra Docker
```bash
# Xem các image đã build
docker images

# Xem các container đang chạy
docker ps
```

### Kiểm tra project directory
```bash
# Kiểm tra git status
cd $PROJECT_DIR && git status

# Kiểm tra tags
cd $PROJECT_DIR && git tag -l
```