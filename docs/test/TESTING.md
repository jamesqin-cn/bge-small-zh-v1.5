# memory-lancedb 插件测试指南

## 快速开始

### 1. 启动服务

```bash
npm start
```

等待 15 秒让服务启动和模型加载完成。

### 2. 检查服务状态

```bash
curl http://localhost:7078/health

# 预期响应:
# {"status":"ok","model":"bge-small-zh-v1.5","dimensions":512,"ready":true,"port":7078}
```

### 3. 运行测试（三选一）

#### 选项 A：交互式测试（推荐）

```bash
./scripts/run-tests.sh
```

会引导你选择测试方式。

#### 选项 B：快速测试

```bash
./scripts/test/test-quick.sh
```

5 分钟完成基本测试。

#### 选项 C：完整自动化测试

```bash
node scripts/test/test-memory-plugin.js
```

详细的自动化测试，包含所有功能验证和性能指标。

---

## 测试内容

### ✅ 基础功能测试

#### 1. 向量生成

```bash
# 单条文本
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "我的名字是张三，今年 30 岁"}'

# 批量文本
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": ["我喜欢打篮球", "我热爱篮球运动"]}'
```

**验证点：**
- ✅ 返回 `data` 数组
- ✅ 向量维度为 512
- ✅ 向量已归一化（范数为 1）
- ✅ 生成时间 < 500ms

### ✅ autoCapture 测试

**触发场景（满足任一即可）：**

```bash
# 1. 个人信息
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "我叫李四，28 岁，前端开发工程师"}'

# 2. 偏好设置
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "我更喜欢使用 TypeScript"}'

# 3. 重要事实
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "我住在北京市朝阳区"}'

# 4. 计划承诺
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "下周完成项目开发"}'

# 5. 情感状态
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "最近工作压力很大"}'
```

**验证方法：**

```bash
# 查看日志，应该看到向量生成记录
tail -f logs/combined.log

# 预期日志：
# {"timestamp":"...","level":"info","message":"开始生成向量",...}
# {"timestamp":"...","level":"info","message":"向量生成成功",...}
```

### ✅ autoRecall 测试

**完整测试流程：**

```bash
# 步骤 1: 存储记忆
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "用户名叫王五，35 岁，喜欢喝茶和旅行"}'

# 步骤 2: 查询记忆
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "用户叫什么名字？"}'

# 步骤 3: 查看召回日志
grep -i "recall" logs/combined.log
```

### ✅ 性能测试

```bash
# 测试批量性能（10 条文本）
time curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": ["文本 1", "文本 2", "文本 3", "文本 4", "文本 5", 
                 "文本 6", "文本 7", "文本 8", "文本 9", "文本 10"]}'
```

**预期：** 10 条文本生成时间 < 2 秒

---

## 性能指标

| 指标 | 预期值 |
|------|--------|
| 向量生成时间（单条） | < 500ms |
| 向量生成时间（10 条） | < 2000ms |
| 向量维度 | 512 |
| 内存占用 | ~100MB |
| 语义相似度阈值 | > 0.7 |

---

## 测试报告模板

使用 `TEST-REPORT.md` 记录测试结果：

```bash
cat docs/test/TEST-REPORT.md
```

填写实际测试结果，用于项目验收和质量检查。

---

## 常见问题

### 问题 1: 服务无法启动

```bash
# 检查端口占用
lsof -i :7078

# 杀掉进程并重启
kill -9 <PID>
npm start
```

### 问题 2: 向量生成失败

```bash
# 查看详细错误
tail -100 logs/combined.log

# 检查模型是否加载完成
grep "模型加载完成" logs/combined.log
```

### 问题 3: autoCapture/autoRecall 未触发

```bash
# 检查配置
cat openclaw.json | grep -A 15 "memory-lancedb"

# 确认以下配置为 true
# "autoCapture": true
# "autoRecall": true
# "baseUrl": "http://localhost:7078/v1"
```

---

## 维护与监控

### 日志管理

```bash
# 实时查看日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log

# 清理旧日志（保留最近 100MB）
du -sh logs/*
```

### 健康检查

```bash
# 定期检查服务状态
watch -n 5 'curl -s http://localhost:7078/health | jq .ready'
```

### 性能监控

```bash
# 查看服务响应时间
grep "请求完成" logs/combined.log | \
  awk -F'duration: ' '{print $2}' | \
  awk -F'ms' '{print $1}' | \
  sort -n | tail -10
```

---

## 快速参考

### 测试脚本位置

| 脚本 | 路径 |
|------|------|
| 交互式测试 | `scripts/run-tests.sh` |
| 快速测试 | `scripts/test/test-quick.sh` |
| 完整测试 | `scripts/test/test-memory-plugin.js` |

### 文档位置

| 文档 | 路径 |
|------|------|
| 项目主文档 | `README.md` |
| 测试指南 | `docs/test/TESTING.md` |
| 测试报告模板 | `docs/test/TEST-REPORT.md` |

---

**最后更新**: 2026-04-27
