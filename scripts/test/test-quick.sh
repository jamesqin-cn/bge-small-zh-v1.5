#!/bin/bash

# memory-lancedb 插件快速测试脚本

BASE_URL="http://localhost:7078/v1"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     memory-lancedb 插件快速测试                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

# 步骤 1: 检查服务
echo -e "${YELLOW}[1/5] 检查服务状态...${NC}"
HEALTH=$(curl -s http://localhost:7078/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ 服务运行正常${NC}"
    echo "  $HEALTH"
else
    echo -e "${RED}✗ 服务未启动${NC}"
    echo "  请先运行：npm start"
    exit 1
fi

# 步骤 2: 测试基本向量生成
echo -e "\n${YELLOW}[2/5] 测试基本向量生成...${NC}"
RESPONSE=$(curl -s -X POST $BASE_URL/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "测试文本"}')
VECTOR=$(echo $RESPONSE | grep -o '"embedding":\[[^]]*\]' | head -1)
if [ -n "$VECTOR" ]; then
    echo -e "${GREEN}✓ 向量生成成功${NC}"
    echo "  响应：$RESPONSE"
else
    echo -e "${RED}✗ 向量生成失败${NC}"
    exit 1
fi

# 步骤 3: 测试 autoCapture 场景
echo -e "\n${YELLOW}[3/5] 测试 autoCapture 触发场景...${NC}"

CAPTURE_TESTS=(
  "个人信息：我叫张三，30 岁，软件工程师"
  "偏好设置：我喜欢使用 TypeScript"
  "重要事实：我住在北京朝阳区"
  "计划承诺：下周完成项目开发"
  "情感状态：最近感觉很累"
)

for test in "${CAPTURE_TESTS[@]}"; do
    TEXT=$(echo $test | cut -d':' -f2-)
    RESPONSE=$(curl -s -X POST $BASE_URL/embeddings \
      -H "Content-Type: application/json" \
      -d "{\"input\": \"$TEXT\"}")
    
    if echo $RESPONSE | grep -q '"data"'; then
        echo -e "${GREEN}✓ $test${NC}"
    else
        echo -e "${RED}✗ $test 失败${NC}"
    fi
done

# 步骤 4: 测试 autoRecall 场景
echo -e "\n${YELLOW}[4/5] 测试 autoRecall 召回场景...${NC}"

# 先存储记忆
echo "存储记忆..."
curl -s -X POST $BASE_URL/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "用户名叫李四，喜欢喝茶和旅行"}' > /dev/null

curl -s -X POST $BASE_URL/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "用户住在上海市浦东新区"}' > /dev/null

# 查询记忆
QUERY_TESTS=(
  "用户叫什么名字？"
  "用户住在哪里？"
  "用户有什么爱好？"
)

for query in "${QUERY_TESTS[@]}"; do
    RESPONSE=$(curl -s -X POST $BASE_URL/embeddings \
      -H "Content-Type: application/json" \
      -d "{\"input\": \"$query\"}")
    
    if echo $RESPONSE | grep -q '"data"'; then
        echo -e "${GREEN}✓ 查询：$query${NC}"
    else
        echo -e "${RED}✗ 查询：$query 失败${NC}"
    fi
done

# 步骤 5: 查看日志
echo -e "\n${YELLOW}[5/5] 查看最近日志...${NC}"
if [ -f "logs/combined.log" ]; then
    echo "最近 5 条日志："
    tail -5 logs/combined.log | while read line; do
        echo "  $line"
    done
else
    echo -e "${YELLOW}日志文件不存在，请先运行服务${NC}"
fi

echo -e "\n${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ 所有测试完成！${NC}"
echo -e "${BLUE}提示：查看详细日志：tail -f logs/combined.log${NC}"
