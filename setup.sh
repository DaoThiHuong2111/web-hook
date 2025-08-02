#!/bin/bash

# Script setup cho webhook CI server

echo "=== Setting up Next.js Webhook CI Server ==="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker chưa được cài đặt. Vui lòng cài đặt Docker trước."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js chưa được cài đặt. Vui lòng cài đặt Node.js trước."
    exit 1
fi

echo "✅ Docker và Node.js đã được cài đặt"

# Install dependencies
echo "📦 Cài đặt dependencies..."
npm install

# Create project directory if specified
if [ ! -z "$PROJECT_DIR" ]; then
    echo "📁 Tạo project directory: $PROJECT_DIR"
    sudo mkdir -p "$PROJECT_DIR"
    sudo chown $(whoami):$(whoami) "$PROJECT_DIR"
    
    if [ ! -z "$REPO_URL" ]; then
        echo "📥 Clone repository lần đầu..."
        git clone "$REPO_URL" "$PROJECT_DIR"
    fi
fi

echo "✅ Setup hoàn tất!"
echo ""
echo "📋 Các bước tiếp theo:"
echo "1. Tạo file .env với các thông tin cần thiết"
echo "2. Cấu hình GitHub webhook URL: http://your-server:3000/webhook"
echo "3. Chạy server: npm start hoặc npm run dev"