#!/usr/bin/env node

/**
 * memory-lancedb 插件测试脚本
 * 测试 autoCapture 和 autoRecall 功能
 */

// Node 22+ 内置 fetch，无需额外依赖
const fetch = globalThis.fetch || require('node-fetch');

const BASE_URL = 'http://localhost:7078';
const HEALTH_URL = 'http://localhost:7078/health';
const EMBEDDING_URL = 'http://localhost:7078/v1/embeddings';
const EMBEDDING_MODEL = 'bge-small-zh-v1.5';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkHealth() {
  log(colors.cyan, '\n=== 步骤 1: 检查服务健康状态 ===');
  try {
    const response = await fetch(HEALTH_URL);
    const data = await response.json();
    
    if (data.status === 'ok' && data.ready) {
      log(colors.green, '✓ 服务运行正常');
      log(colors.green, `  模型：${data.model}`);
      log(colors.green, `  维度：${data.dimensions}`);
      log(colors.green, `  端口：${data.port}`);
      return true;
    } else {
      log(colors.red, '✗ 服务未就绪');
      return false;
    }
  } catch (error) {
    log(colors.red, `✗ 无法连接到服务：${error.message}`);
    return false;
  }
}

async function testEmbedding() {
  log(colors.cyan, '\n=== 步骤 2: 测试向量生成 ===');
  
  const testTexts = [
    '我的名字是张三，今年 30 岁，是一名软件工程师',
    '我喜欢打篮球和阅读',
    '我住在北京市朝阳区'
  ];
  
  try {
    const response = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: testTexts })
    });
    
    const data = await response.json();
    
    if (data.data && data.data.length === 3) {
      log(colors.green, '✓ 向量生成成功');
      log(colors.green, `  生成 ${data.data.length} 个向量`);
      log(colors.green, `  向量维度：${data.data[0].embedding.length}`);
      
      // 显示第一个向量的前 10 个值
      const firstVec = data.data[0].embedding;
      log(colors.cyan, `  示例向量 (前 10 个): [${firstVec.slice(0, 10).map(v => v.toFixed(4)).join(', ')}]`);
      
      return true;
    } else {
      log(colors.red, '✗ 向量生成失败');
      return false;
    }
  } catch (error) {
    log(colors.red, `✗ 测试失败：${error.message}`);
    return false;
  }
}

async function testSimilarity() {
  log(colors.cyan, '\n=== 步骤 3: 测试语义相似度 ===');
  
  const similarTexts = [
    '我喜欢打篮球',
    '我热爱篮球运动'
  ];
  
  const dissimilarTexts = [
    '我喜欢打篮球',
    '我喜欢吃火锅'
  ];
  
  try {
    // 计算相似度
    const response1 = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: similarTexts })
    });
    
    const response2 = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: dissimilarTexts })
    });
    
    const data1 = await response1.json();
    const data2 = await response2.json();
    
    // 计算余弦相似度
    function cosineSimilarity(a, b) {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    
    const similarScore = cosineSimilarity(data1.data[0].embedding, data1.data[1].embedding);
    const dissimilarScore = cosineSimilarity(data2.data[0].embedding, data2.data[1].embedding);
    
    log(colors.green, '✓ 语义相似度计算完成');
    log(colors.green, `  相似文本 ("打篮球" vs "篮球运动"): ${similarScore.toFixed(4)}`);
    log(colors.green, `  不相似文本 ("打篮球" vs "吃火锅"): ${dissimilarScore.toFixed(4)}`);
    
    if (similarScore > dissimilarScore) {
      log(colors.green, '✓ 模型能够正确区分相似和不相似的文本');
      return true;
    } else {
      log(colors.yellow, '⚠ 相似度结果可能不理想');
      return false;
    }
  } catch (error) {
    log(colors.red, `✗ 测试失败：${error.message}`);
    return false;
  }
}

async function testAutoCaptureScenarios() {
  log(colors.cyan, '\n=== 步骤 4: 测试 autoCapture 触发场景 ===');
  
  const captureScenarios = [
    {
      name: '个人信息',
      text: '我叫李四，28 岁，是一名前端开发工程师，有 5 年经验'
    },
    {
      name: '偏好设置',
      text: '我更喜欢使用 TypeScript 而不是 JavaScript'
    },
    {
      name: '重要事实',
      text: '我的办公室在海淀区中关村科技园 A 座 15 层'
    },
    {
      name: '计划承诺',
      text: '我计划下周完成项目的第一阶段开发'
    },
    {
      name: '情感状态',
      text: '最近工作压力很大，感觉很疲惫'
    }
  ];
  
  try {
    for (const scenario of captureScenarios) {
      const response = await fetch(EMBEDDING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: scenario.text })
      });
      
      const data = await response.json();
      
      if (data.data && data.data.length === 1) {
        log(colors.green, `✓ ${scenario.name}: 成功生成向量`);
      } else {
        log(colors.red, `✗ ${scenario.name}: 生成失败`);
      }
    }
    return true;
  } catch (error) {
    log(colors.red, `✗ 测试失败：${error.message}`);
    return false;
  }
}

async function testAutoRecallScenarios() {
  log(colors.cyan, '\n=== 步骤 5: 测试 autoRecall 召回场景 ===');
  
  // 先存储一些记忆
  const memories = [
    '用户名叫王五，35 岁，喜欢喝茶和旅行',
    '用户住在上海市浦东新区，工作在上海科技公司',
    '用户有一个孩子，今年 5 岁，在上幼儿园'
  ];
  
  // 然后测试召回
  const queries = [
    '用户叫什么名字？',
    '用户住在哪里？',
    '用户有什么爱好？'
  ];
  
  try {
    // 生成记忆向量
    const memoryResponse = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: memories })
    });
    const memoryData = await memoryResponse.json();
    
    log(colors.green, '✓ 生成记忆向量完成');
    
    // 生成查询向量
    for (const query of queries) {
      const queryResponse = await fetch(EMBEDDING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: query })
      });
      
      const queryData = await queryResponse.json();
      
      // 计算与所有记忆的相似度
      const queryVec = queryData.data[0].embedding;
      const similarities = memoryData.data.map((mem, i) => ({
        index: i,
        text: memories[i],
        score: cosineSimilarity(queryVec, mem.embedding)
      }));
      
      // 按相似度排序
      similarities.sort((a, b) => b.score - a.score);
      
      log(colors.green, `✓ 查询："${query}"`);
      log(colors.cyan, `  最相关的记忆 (top 1): ${similarities[0].text.substring(0, 30)}... (相似度：${similarities[0].score.toFixed(4)})`);
    }
    
    return true;
  } catch (error) {
    log(colors.red, `✗ 测试失败：${error.message}`);
    return false;
  }
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runAllTests() {
  log(colors.cyan, '╔════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║     memory-lancedb 插件功能测试                         ║');
  log(colors.cyan, '║     测试 autoCapture 和 autoRecall 功能                  ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════╝');
  
  const results = {
    health: await checkHealth(),
    embedding: false,
    similarity: false,
    autoCapture: false,
    autoRecall: false
  };
  
  if (results.health) {
    results.embedding = await testEmbedding();
    results.similarity = await testSimilarity();
    results.autoCapture = await testAutoCaptureScenarios();
    results.autoRecall = await testAutoRecallScenarios();
  }
  
  // 总结
  log(colors.cyan, '\n=== 测试总结 ===');
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  log(colors.green, `通过：${passed}/${total}`);
  
  if (passed === total) {
    log(colors.green, '✓ 所有测试通过！');
    log(colors.cyan, '\n提示：可以查看日志文件验证 autoCapture 和 autoRecall 的详细记录：');
    log(colors.cyan, '  tail -f logs/combined.log');
  } else {
    log(colors.red, '✗ 部分测试失败，请检查日志');
  }
}

runAllTests().catch(error => {
  log(colors.red, `测试过程中发生错误：${error.message}`);
  log(colors.yellow, '请检查：');
  log(colors.yellow, '  1. 服务是否已启动：npm start');
  log(colors.yellow, '  2. 是否正确安装了依赖：npm install');
  process.exit(1);
});
