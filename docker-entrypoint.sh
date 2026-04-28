#!/bin/bash

echo "🚀 开始启动 BGE Embedding Service..."

# 设置 HuggingFace 镜像源（国内加速）
export HF_ENDPOINT=${HF_ENDPOINT:-https://hf-mirror.com}
echo "📍 使用镜像源：$HF_ENDPOINT"

# 无限循环重试下载
RETRY_COUNT=1
while true; do
  echo "📥 开始下载模型文件 (第 $RETRY_COUNT 次尝试)..."
  
  if npm run download -- --yes; then
    echo "✅ 模型下载成功！"
    break
  else
    echo "❌ 模型下载失败，将在 5 秒后重试..."
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 5
  fi
done

# 创建软链接（在 node_modules 下）
echo "🔗 创建软链接..."
node scripts/create-symlink.js

# 启动服务（使用本地模型）
echo "🌐 启动服务..."
npm run start
