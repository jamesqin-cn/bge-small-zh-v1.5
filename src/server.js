const express = require('express');
const cors = require('cors');
const { pipeline, env } = require('@xenova/transformers');
const { logger, generateRequestId } = require('./logger');
const path = require('path');
const fs = require('fs');

// 设置模型路径
const MODEL_LOCAL_PATH = path.resolve(__dirname, '..', 'models', 'bge-small-zh-v1.5');

// 设置 HuggingFace 缓存目录为本地模型目录
process.env.HF_HUB_CACHE = MODEL_LOCAL_PATH;
process.env.XTRANSFORMERS_HUB_CACHE = MODEL_LOCAL_PATH;

// 禁止网络下载，强制使用本地模型
env.allowLocalModels = true;
env.allowDownloads = false;

// transformers 库需要模型在 node_modules/@xenova/transformers/models/ 下
// 使用符号链接方式加载模型
const NODE_MODULES_MODELS = path.join(
  __dirname,
  '..',
  'node_modules',
  '@xenova',
  'transformers',
  'models'
);
const SYMLINK_PATH = path.join(NODE_MODULES_MODELS, 'bge-small-zh-v1.5');

// 删除旧的符号链接并重新创建（确保指向正确的路径）
function ensureSymlink() {
  const targetDir = MODEL_LOCAL_PATH;
  
  // 确保 models 目录存在
  if (!fs.existsSync(NODE_MODULES_MODELS)) {
    fs.mkdirSync(NODE_MODULES_MODELS, { recursive: true });
  }
  
  // 检查符号链接是否存在
  if (fs.existsSync(SYMLINK_PATH)) {
    const stats = fs.lstatSync(SYMLINK_PATH);
    if (stats.isSymbolicLink()) {
      const existingTarget = fs.readlinkSync(SYMLINK_PATH);
      if (existingTarget === targetDir) {
        logger.info(`符号链接已存在：${SYMLINK_PATH} -> ${existingTarget}`);
        return;
      }
      // 指向不同目标，删除旧链接
      fs.unlinkSync(SYMLINK_PATH);
    } else {
      // 是普通目录，删除
      fs.rmSync(SYMLINK_PATH, { recursive: true });
    }
  }
  
  // 创建符号链接
  fs.symlinkSync(targetDir, SYMLINK_PATH);
  logger.info(`符号链接已创建：${SYMLINK_PATH} -> ${targetDir}`);
}

const app = express();
const PORT = process.env.PORT || 7078;
const MODEL_NAME = 'bge-small-zh-v1.5';
const MODEL_ID = 'bge-small-zh-v1.5';
const MODEL_DIMENSIONS = 512; // BGE Small Chinese v1.5 的维度是 512
const MODEL_CREATED_AT = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000);

// 中间件
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  const requestId = generateRequestId();
  req.requestId = requestId;
  req.startTime = Date.now();
  
  logger.info('请求开始', { requestId, method: req.method, url: req.url, ip: req.ip });
  next();
});

// 响应完成日志
app.use((req, res, next) => {
  const end = res.end;
  res.end = function(...args) {
    if (req.requestId) {
      const duration = Date.now() - req.startTime;
      logger.info('请求完成', { 
        requestId: req.requestId, 
        status: res.statusCode,
        duration: `${duration}ms`
      });
    }
    end.apply(res, args);
  };
  next();
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('错误发生', { 
    requestId: req.requestId,
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({ error: '服务器内部错误' });
});

// 全局模型
let embedPipeline = null;

async function initModel() {
  try {
    logger.info(`加载模型：${MODEL_NAME}`);
    logger.info(`本地模型路径：${MODEL_LOCAL_PATH}`);
    
    // 确保符号链接存在
    ensureSymlink();
    
    // 验证本地模型文件
    logger.info('检查本地模型文件...');
    const requiredFiles = [
      'config.json',
      'quantize_config.json',
      'special_tokens_map.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'vocab.txt',
      'onnx/model.onnx',
      'onnx/model_quantized.onnx'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(MODEL_LOCAL_PATH, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`本地模型缺少必要文件：${file}`);
      }
      const size = fs.statSync(filePath).size;
      logger.info(`  ✓ ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    logger.info('开始加载模型...');
    console.log('\n=== 模型加载详细日志 ===');
    console.log('模型路径:', SYMLINK_PATH);
    
    // 使用符号链接路径加载模型
    embedPipeline = await pipeline('feature-extraction', 'bge-small-zh-v1.5', {
      quantized: false,
      model_kwargs: {
        trust_remote_code: true
      },
      device: 'cpu'
    });
    logger.info(`模型加载完成 (维度：${MODEL_DIMENSIONS})`);
  } catch (err) {
    const errorMessage = err.message || '未知错误';
    const errorType = detectErrorType(err);
    
    logger.error('模型加载失败', {
      error: errorMessage,
      errorType: errorType,
      localModel: true
    });
    
    // 提供更具体的错误提示
    const suggestions = getSuggestions(errorType, errorMessage);
    console.error('\n❌ 模型加载失败！');
    console.error(`   错误：${errorMessage}`);
    console.error('\n🔧 可能的原因和解决方案：');
    suggestions.forEach((s, i) => console.error(`   ${i + 1}. ${s}`));
    console.error('\n💡 建议：');
    if (errorType === 'local') {
      console.error('   - 检查模型文件是否完整');
      console.error('   - 重新下载模型：npm run download');
    } else {
      console.error('   - 查看详细错误日志');
      console.error('   - 重新下载模型：npm run download');
    }
    console.error('\n📖 更多信息请查看 README.md\n');
    
    process.exit(1);
  }
}

// 检测错误类型
function detectErrorType(err) {
  const message = (err.message || '').toLowerCase();
  
  if (message.includes('not found') || message.includes('enoent')) {
    return 'local';
  }
  if (message.includes('disk') || message.includes('space') || message.includes('no space')) {
    return 'disk';
  }
  if (message.includes('permission') || message.includes('access denied')) {
    return 'permission';
  }
  
  return 'unknown';
}

// 获取错误建议
function getSuggestions(errorType, errorMessage) {
  if (errorType === 'local') {
    return [
      '本地模型文件不存在或损坏',
      '检查模型目录：./models/bge-small-zh-v1.5/',
      '重新下载模型：npm run download'
    ];
  }
  
  if (errorType === 'disk') {
    return [
      '磁盘空间不足',
      '清理磁盘空间后重试'
    ];
  }
  
  if (errorType === 'permission') {
    return [
      '没有文件读取权限',
      '检查目录权限'
    ];
  }
  
  return [
    '检查模型文件是否完整',
    '重新下载模型：npm run download'
  ];
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    model: MODEL_ID,
    dimensions: MODEL_DIMENSIONS,
    ready: !!embedPipeline,
    port: PORT,
    useLocalModel: true,
    localModelPath: MODEL_LOCAL_PATH
  });
});

app.get('/v1/models', (req, res) => {
  res.json({
    object: "list",
    data: [
      {
        id: MODEL_ID,
        object: "model",
        created: MODEL_CREATED_AT,
        owned_by: "xenova",
        permission: [],
        root: MODEL_ID,
        parent: null
      }
    ]
  });
});

function vecToBase64(vec) {
  const buf = Buffer.from(new Float32Array(vec).buffer);
  return buf.toString('base64');
}

app.post('/v1/embeddings', async (req, res) => {
  const requestId = req.requestId;
  try {
    if (!embedPipeline) {
      logger.warn('模型未就绪', { requestId });
      return res.status(503).json({ error: '模型初始化中' });
    }

    const { input, encoding_format } = req.body;
    if (!input) {
      logger.warn('缺少 input 参数', { requestId });
      return res.status(400).json({ error: '缺少 input' });
    }

    if (encoding_format !== undefined && encoding_format !== 'float' && encoding_format !== 'base64') {
      logger.warn('无效的 encoding_format', { requestId, encoding_format });
      return res.status(400).json({ error: 'encoding_format 仅支持 float 或 base64' });
    }
    const useBase64 = encoding_format === 'base64';

    const texts = Array.isArray(input) ? input : [input];

    if (texts.length === 0) {
      logger.warn('input 数组为空', { requestId });
      return res.status(400).json({ error: 'input 数组不能为空' });
    }
    for (let i = 0; i < texts.length; i++) {
      if (typeof texts[i] !== 'string' || texts[i].trim() === '') {
        logger.warn(`input[${i}] 无效`, { requestId, index: i });
        return res.status(400).json({ error: `input[${i}] 必须是非空字符串` });
      }
    }

    const sample = texts[0].length > 20 ? texts[0].substring(0, 20) + '...' : texts[0];
    logger.info('开始生成向量', { requestId, count: texts.length, sample });

    const output = await embedPipeline(texts, {
      pooling: 'mean',
      normalize: true,
      // Nomic 模型需要特定的参数
      device: 'cpu',
    });

    const embeddings = output.tolist();

    res.json({
      object: "list",
      data: embeddings.map((vec, i) => ({
        object: "embedding",
        embedding: useBase64 ? vecToBase64(vec) : vec,
        index: i
      })),
      model: MODEL_ID,
      usage: { prompt_tokens: 0, total_tokens: 0 }
    });

    logger.info('向量生成成功', { requestId, count: texts.length, sample });

  } catch (error) {
    logger.error('生成向量失败', { requestId, error: error.message });
    res.status(500).json({ error: '生成向量失败' });
  }
});

initModel().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info('服务启动', { 
      port: PORT, 
      model: MODEL_ID, 
      dimensions: MODEL_DIMENSIONS,
      useLocalModel: true,
      localModelPath: MODEL_LOCAL_PATH
    });
  });
});
