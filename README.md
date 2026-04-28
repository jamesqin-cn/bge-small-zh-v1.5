# BGE Small Chinese v1.5 向量嵌入服务

基于 HuggingFace 模型 [BAAI/bge-small-zh-v1.5](https://huggingface.co/BAAI/bge-small-zh-v1.5) 构建的高性能中文文本向量化服务。项目采用本地模型加载方式，支持 OpenAI 兼容 API 接口，可直接集成到 RAG 系统、语义搜索和 AI 记忆等场景。

---

## 1. 向量嵌入服务简介

### 什么是向量嵌入？

向量嵌入（Embedding）是将文本、图片等内容转换为固定维度数值向量的技术，使得"语义相似的内容在向量空间中距离更近"。

### 向量搜索服务的作用

```
用户查询 → 向量化 → 向量数据库检索 → 返回最相关结果
```

| 应用场景 | 说明 |
|----------|------|
| **RAG 检索增强** | 将知识库文档向量化，检索时找到最相关的上下文 |
| **语义搜索** | 比关键词搜索更理解用户意图 |
| **相似度匹配** | 文本分类、推荐系统、去重等 |
| **AI 长期记忆** | 存储记忆向量，检索历史相关信息 |
| **多语言处理** | 统一语义空间，支持跨语言检索 |

### 工作原理

```
文本 → Tokenize → 模型推理 → 池化 → 归一化 → 512维向量
```

---

## 2. BGE 模型系列对比

### 各尺寸模型规格

| 模型 | 维度 | 参数量 | 内存占用 | 速度 | 中文效果 | 适用场景 |
|------|------|--------|----------|------|----------|----------|
| **bge-small-zh-v1.5** | 512 | ~40M | ~80MB | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | 资源受限、轻量级场景、本服务 |
| **bge-base-zh-v1.5** | 768 | ~110M | ~220MB | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | 中文知识库、FAQ匹配（推荐） |
| **bge-large-zh-v1.5** | 1024 | ~400M | ~800MB | ⚡⚡ | ⭐⭐⭐⭐⭐ | 高精度场景、复杂语义理解 |
| **bge-m3** | 1024 | ~600M | ~1.2GB | ⚡⚡ | ⭐⭐⭐⭐ | 多语言场景、混合检索 |

### 选型建议

```
资源受限 / 快速部署 / 边缘设备
    ↓
    bge-small-zh-v1.5 ← 本服务选用

中文知识库 / 均衡性能 / 成本可控
    ↓
    bge-base-zh-v1.5 ← 推荐首选

高精度需求 / 长文档 / 复杂语义
    ↓
    bge-large-zh-v1.5

多语言 / 混合检索
    ↓
    bge-m3
```

---

## 3. BGE 与 Nomic 对比

### 核心特性对比

| 特性 | BGE 系列 | Nomic Embed Text |
|------|----------|------------------|
| **中文支持** | ✅ 优秀，专为中文优化 | ❌ 较弱，主要优化英文 |
| **英文支持** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **多语言支持** | ✅ 100+ 语言 | ❌ 英文为主 |
| **向量维度** | 512/768/1024 | 768 |
| **检索模式** | 密集 + 稀疏 + 混合 | 仅密集 |
| **上下文长度** | 8192 tokens | 4096 tokens |
| **MTEB 排名** | Top 5 | Top 10 |
| **许可证** | Apache 2.0 | MIT |

### BGE 的优势

- **中文场景首选**：BGE 是中国团队（BAAI）开发，中文语义理解更准确
- **多语言扩展**：bge-m3 支持 100+ 语言，适合国际化业务
- **混合检索**：支持密集向量 + 稀疏权重，召回率更高
- **更长上下文**：8192 tokens，适合长文档处理

### Nomic 的特点

- **英文专用场景**：如果只需英文，Nomic 推理更快（350M 参数）
- **轻量部署**：参数量更小，适合边缘设备
- **生态丰富**：LangChain/LlamaIndex 集成友好

### 选型决策

| 需求 | 推荐 |
|------|------|
| 中文语义搜索 | ✅ **BGE** |
| 英文为主 | BGE / Nomic 均可 |
| 多语言系统 | ✅ **BGE** |
| 轻量/边缘部署 | BGE-small / **Nomic** |
| RAG 知识库 | ✅ **BGE-base** |

---

## 4. OpenClaw Memory-LanceDB 对接

### 什么是 OpenClaw？

OpenClaw 是一个自托管 AI 网关，支持多渠道接入（Discord、Telegram、WhatsApp 等）和长期记忆管理。

### Memory-LanceDB 插件作用

```
用户对话 → 关键信息捕获 → 向量化 → LanceDB 存储
用户提问 → 问题向量化 → 相似度检索 → 返回相关记忆
```

### 配置步骤

#### 4.1 配置文件位置

OpenClaw 配置文件位于 `~/.openclaw/openclaw.json`，使用 JSON5 格式。

#### 4.2 完整配置示例

```json
{
  "plugins": {
    "slots": {
      "memory": "memory-lancedb"
    },
    "entries": {
      "memory-lancedb": {
        "enabled": true,
        "config": {
          "embedding": {
            "provider": "openai",
            "model": "bge-small-zh-v1.5",
            "apiKey": "_NO_NEED_",
            "baseUrl": "http://<宿主机 IP>:7078/v1",
            "dimensions": 512
          },
          "dbPath": "~/.openclaw/workspace/memory/lancedb",
          "autoCapture": true,
          "autoRecall": true,
          "recallMaxChars": 1000,
          "captureMaxChars": 500
        }
      }
    }
  }
}
```

#### 4.3 配置参数说明

**Embedding 配置：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `provider` | String | 嵌入服务提供商，设为 `openai` 使用兼容接口 |
| `model` | String | 模型标识符：`bge-small-zh-v1.5` |
| `apiKey` | String | API 密钥，本地服务填 `_NO_NEED_` |
| `baseUrl` | String | 本服务地址：`http://<宿主机 IP>:7078/v1` |
| `dimensions` | Integer | 向量维度：`512` |

**记忆控制参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoRecall` | Boolean | `true` | 每次回复前自动检索相关记忆 |
| `autoCapture` | Boolean | `false` | 自动捕获 AI 回复为记忆 |
| `recallMaxChars` | Integer | `1000` | 检索时最大文本长度 |
| `captureMaxChars` | Integer | `500` | 捕获时最大字符数 |

**存储配置：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `dbPath` | String | LanceDB 数据路径，默认 `~/.openclaw/memory/lancedb` |
| `storageOptions` | Object | 可配置 S3 等云存储 |

#### 4.4 应用配置

```bash
# 重启 OpenClaw Gateway
openclaw gateway restart

# 验证插件加载
openclaw plugins list
```

#### 4.5 验证功能

启动本服务和 OpenClaw 后，发送：

```
记住，我的名字是张三，我周末喜欢爬山
```

然后问：

```
我周末有什么爱好？
```

如果 AI 正确回答"爬山"，说明 memory-lancedb 插件工作正常。

---

## 5. API 接口

### 健康检查

```
GET /health
```

**响应：**

```json
{
  "status": "ok",
  "model": "bge-small-zh-v1.5",
  "dimensions": 512,
  "ready": true,
  "port": 7078
}
```

### 模型列表

```
GET /v1/models
```

**响应：**

```json
{
  "object": "list",
  "data": [
    {
      "id": "bge-small-zh-v1.5",
      "object": "model",
      "created": 1704067200,
      "owned_by": "xenova"
    }
  ]
}
```

### 向量生成（核心接口）

```
POST /v1/embeddings
Content-Type: application/json

{
  "input": "要向量化文本",
  "encoding_format": "float"
}
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `input` | string \| string[] | 是 | 要向量化的文本 |
| `encoding_format` | string | 否 | `float` 或 `base64`，默认 `float` |

**响应示例：**

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.123, -0.456, ...],
      "index": 0
    }
  ],
  "model": "bge-small-zh-v1.5",
  "usage": {
    "prompt_tokens": 0,
    "total_tokens": 0
  }
}
```

**批量请求示例：**

```bash
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": ["打篮球", "篮球运动", "吃火锅"],
    "encoding_format": "float"
  }'
```

---

## 6. 快速开始

### 环境要求

- Node.js >= 18
- 磁盘空间 >= 200MB

### 安装步骤

```bash
# 克隆项目
git clone https://github.com/jamesqin-cn/bge-small-zh-v1.5.git
cd bge-small-zh-v1.5

# 安装依赖
npm install

# 下载模型
npm run download

# 启动服务
npm start
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `7078` | 服务端口 |
| `HF_HUB_CACHE` | `./models/bge-small-zh-v1.5` | 模型缓存目录 |

### 启动验证

```bash
# 检查服务状态
curl http://localhost:7078/health

# 测试向量生成
curl -X POST http://localhost:7078/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "你好世界"}'
```

---

## 7. 项目结构

```
bge-small-zh-v1.5/
├── src/
│   ├── server.js      # 主服务入口
│   └── logger.js      # 日志模块
├── models/
│   └── bge-small-zh-v1.5/  # 本地模型文件
├── tests/
│   └── test.js        # 测试脚本
├── package.json
└── README.md
```

---

## 8. 语义相似度示例

向量生成后可使用余弦相似度计算文本相似度：

| 文本对 | 相似度 | 说明 |
|--------|--------|------|
| "打篮球" ↔ "篮球运动" | 0.8711 | 高相似 |
| "打篮球" ↔ "吃火锅" | 0.5506 | 低相似 |

---

## 9. 错误处理

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查 input 格式 |
| 503 | 模型未就绪 | 等待模型加载完成 |
| 500 | 服务器内部错误 | 查看服务日志 |

---

## 10. License

MIT
