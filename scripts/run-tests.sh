#!/bin/bash

# memory-lancedb 插件测试启动脚本

echo "╔════════════════════════════════════════════════════════╗"
echo "║     memory-lancedb 插件测试启动脚本                    ║"
echo "╚════════════════════════════════════════════════════════╝"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "⚠  未检测到 node_modules，正在安装依赖..."
    npm install
fi

# 检查 node-fetch
if ! npm list node-fetch > /dev/null 2>&1; then
    echo "⚠  未检测到 node-fetch，正在安装..."
    npm install node-fetch --save-dev
fi

# 检查服务是否已启动
if curl -s http://localhost:7078/health > /dev/null 2>&1; then
    echo "✓ 服务已启动"
else
    echo "⚠  服务未启动，正在启动..."
    npm start &
    echo "⏳ 等待服务启动 (15 秒)..."
    sleep 15
fi

# 检查服务状态
echo ""
echo "=== 检查服务状态 ==="
HEALTH=$(curl -s http://localhost:7078/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo "✓ 服务运行正常"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo "✗ 服务未就绪"
    echo "请检查：npm start"
    exit 1
fi

# 询问用户选择测试方式
echo ""
echo "=== 选择测试方式 ==="
echo "1. 完整自动化测试 (node test-memory-plugin.js)"
echo "2. 快速测试 (./test-quick.sh)"
echo "3. 手动测试 (查看 TESTING.md)"
echo "4. 查看日志 (tail -f logs/combined.log)"
echo ""
read -p "请输入选择 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "运行完整自动化测试..."
        node test-memory-plugin.js
        ;;
    2)
        echo ""
        echo "运行快速测试..."
        ./test-quick.sh
        ;;
    3)
        echo ""
        echo "打开测试指南..."
        if command -v open > /dev/null; then
            open TESTING.md
        else
            cat TESTING.md
        fi
        ;;
    4)
        echo ""
        echo "查看日志 (按 Ctrl+C 退出)..."
        tail -f logs/combined.log
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                    测试完成                            ║"
echo "╚════════════════════════════════════════════════════════╝"
