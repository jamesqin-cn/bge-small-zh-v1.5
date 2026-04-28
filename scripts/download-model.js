#!/usr/bin/env node

/**
 * 下载 BGE Small Chinese v1.5 模型到本地
 * 使用方法：node scripts/download-model.js
 * 
 * 注意：使用纯 Node.js 方式下载模型文件
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createWriteStream } = require('fs');
const https = require('https');
const http = require('http');
const zlib = require('zlib');

const MODEL_NAME = 'bge-small-zh-v1.5';
const MODEL_REPO = 'Xenova/bge-small-zh-v1.5';  // ONNX 预转换版本（@xenova/transformers 专用）
// 使用脚本所在目录为基准，models 目录在脚本父目录
const PROJECT_ROOT = path.dirname(__dirname);
const TARGET_DIR = path.join(PROJECT_ROOT, 'models', MODEL_NAME);

// HuggingFace 镜像（默认使用国内镜像加速）
const HF_ENDPOINT = process.env.HF_ENDPOINT || 'https://hf-mirror.com';

console.log('='.repeat(60));
console.log(`下载模型：${MODEL_REPO}`);
console.log(`模型文件：ONNX 格式`);
console.log(`目标目录：${TARGET_DIR}`);
console.log(`镜像源：${HF_ENDPOINT}`);
console.log('='.repeat(60));

// 检查是否强制重新下载
const forceDownload = process.argv.includes('--force');
const yesMode = process.argv.includes('--yes');

if (forceDownload) {
  console.log('🔄 强制重新下载模式');
}
if (yesMode) {
  console.log('✅ 自动确认模式（跳过交互式提示）');
}

// 检查目标目录是否存在
function checkTargetDir() {
  if (fs.existsSync(TARGET_DIR)) {
    const files = fs.readdirSync(TARGET_DIR);
    if (files.length > 0) {
      if (forceDownload) {
        console.log('🔄 强制模式，将删除并重新下载所有文件');
        // 删除目标目录
        fs.rmSync(TARGET_DIR, { recursive: true, force: true });
        return true;
      }
      
      // 非强制模式：检查是否有空文件
      let emptyFiles = 0;
      let totalSize = 0;
      files.forEach(file => {
        const filePath = path.join(TARGET_DIR, file);
        try {
          const size = fs.statSync(filePath).size;
          if (size === 0) {
            emptyFiles++;
          } else {
            totalSize += size;
          }
        } catch (e) {
          // ignore
        }
      });
      
      if (emptyFiles > 0) {
        console.warn(`⚠️  目标目录包含 ${emptyFiles} 个空文件，将自动重新下载`);
        return true;
      }
      
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      console.warn(`⚠️  目标目录已存在且包含 ${files.length} 个文件 (${totalSizeMB} MB)`);
      console.log('📄 将逐个检查文件，缺失或损坏的文件将被下载');
      
      // --yes 模式不取消，继续进入文件检查逻辑
      return true;
    }
  }
  return true;
}

// 获取文件下载链接
async function getDownloadUrl(filename) {
  return new Promise((resolve, reject) => {
    const url = `${HF_ENDPOINT}/${MODEL_REPO}/resolve/main/${filename}`;
    
    const client = url.startsWith('https') ? https : http;
    
    const req = client.request(url, {
      headers: {
        'User-Agent': 'BGE-Model-Downloader'
      },
      method: 'GET'
    });
    
    req.on('response', (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302 || 
          response.statusCode === 303 || response.statusCode === 307 || 
          response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          // 如果是相对路径，转换为绝对路径
          let fullRedirectUrl = redirectUrl;
          if (redirectUrl.startsWith('/')) {
            fullRedirectUrl = new URL(redirectUrl, url).toString();
          }
          getDownloadUrlFromUrl(fullRedirectUrl).then(resolve).catch(reject);
        } else {
          reject(new Error('Redirect without location header'));
        }
      } else if (response.statusCode === 200) {
        resolve(url);
      } else {
        reject(new Error(`Failed to get download URL for ${filename}: ${response.statusCode}`));
      }
      response.destroy();
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// 从 URL 获取最终下载链接（辅助函数）
async function getDownloadUrlFromUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.request(url, {
      headers: {
        'User-Agent': 'BGE-Model-Downloader'
      },
      method: 'GET'
    });
    
    req.on('response', (response) => {
      if (response.statusCode === 301 || response.statusCode === 302 || 
          response.statusCode === 303 || response.statusCode === 307 || 
          response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          getDownloadUrlFromUrl(redirectUrl).then(resolve).catch(reject);
        } else {
          reject(new Error('Redirect without location header'));
        }
      } else if (response.statusCode === 200) {
        resolve(url);
      } else {
        reject(new Error(`Failed to get download URL: ${response.statusCode}`));
      }
      response.destroy();
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// 下载文件
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const dirname = path.dirname(filepath);
    
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    
    let receivedBytes = 0;
    let totalBytes = 0;
    let downloadComplete = false;
    
    const request = client.get(url, {
      headers: {
        'User-Agent': 'BGE-Model-Downloader'
      }
    }, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302 || 
          response.statusCode === 303 || response.statusCode === 307 || 
          response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          let fullRedirectUrl = redirectUrl;
          if (redirectUrl.startsWith('/')) {
            fullRedirectUrl = new URL(redirectUrl, url).toString();
          }
          request.destroy();
          downloadFile(fullRedirectUrl, filepath).then(resolve).catch(reject);
          return;
        }
      }
      
      // 获取文件大小
      totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      
      // 处理 gzip 压缩
      let stream = response;
      if (response.headers['content-encoding'] === 'gzip') {
        stream = stream.pipe(zlib.createGunzip());
      } else if (response.headers['content-encoding'] === 'deflate') {
        stream = stream.pipe(zlib.createInflate());
      }
      
      // 打印下载信息
      if (totalBytes > 0 && !downloadComplete) {
        downloadComplete = true;
        const filename = path.basename(filepath);
        console.log(`\n📥 开始下载：${filename}`);
        console.log(`   预期大小：${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
      }
      
      const writeStream = createWriteStream(filepath);
      
      stream.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = ((receivedBytes / totalBytes) * 100).toFixed(2);
          process.stdout.write(`\r⏳ 下载中：${progress}% (${(receivedBytes / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
        }
      });
      
      stream.pipe(writeStream);
      
      stream.on('error', (err) => {
        writeStream.destroy();
        reject(err);
      });
      
      writeStream.on('error', reject);
      
      writeStream.on('finish', () => {
        // 验证文件大小
        try {
          const stats = fs.statSync(filepath);
          if (stats.size === 0) {
            reject(new Error('Downloaded file is empty (0 bytes)'));
          } else {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(120000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// 下载模型文件
async function downloadModel() {
  console.log('\n📥 开始下载模型文件...\n');
  
  // Xenova/bge-small-zh-v1.5 的 ONNX 格式文件列表
  const configFiles = [
    'config.json',
    'quantize_config.json',
    'special_tokens_map.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'vocab.txt',
    'onnx/model.onnx',
    'onnx/model_quantized.onnx'
  ];
  
  // 创建目标目录
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log(`✅ 创建目录：${TARGET_DIR}\n`);
  }
  
  // 下载配置文件
  console.log('📄 下载配置文件：');
  for (const filename of configFiles) {
    try {
      const filepath = path.join(TARGET_DIR, filename);
      
      // 检查文件是否已存在
      if (fs.existsSync(filepath) && !forceDownload) {
        const size = fs.statSync(filepath).size;
        
        if (size > 0) {
          // 非空文件且非强制模式：跳过下载
          const sizeMB = (size / 1024 / 1024).toFixed(2);
          console.log(`✅ 已存在：${filename} (${sizeMB} MB)`);
          continue;
        } else {
          // 空文件：强制重新下载
          console.warn(`⚠️  文件存在但大小为 0，将重新下载：${filename}`);
        }
      } else if (forceDownload && fs.existsSync(filepath)) {
        // 强制模式：显示覆盖信息
        console.log(`🔄 强制覆盖：${filename}`);
      }
      
      // 获取下载链接
      const downloadUrl = await getDownloadUrl(filename);
      
      // 下载文件
      await downloadFile(downloadUrl, filepath);
      
      // 下载完成后获取文件大小
      const stats = fs.statSync(filepath);
      const size = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✅ 完成：${filename} (${size} MB)`);
      
    } catch (error) {
      console.error(`\n❌ 下载失败 ${filename}:`, error.message);
      throw error;
    }
  }
  
  console.log('\n✅ 所有文件下载完成！');
}

// 验证下载的文件
function validateDownload() {
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

  console.log('\n🔍 验证文件...');
  const missingFiles = [];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(TARGET_DIR, file);
    if (fs.existsSync(filePath)) {
      const size = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
      console.log(`  ✅ ${file} (${size} MB)`);
    } else {
      console.log(`  ❌ ${file} - 缺失`);
      missingFiles.push(file);
    }
  });

  if (missingFiles.length > 0) {
    console.warn(`⚠️  缺少 ${missingFiles.length} 个文件`);
    return false;
  }

  console.log('\n✅ 所有必要文件已下载完成！');
  return true;
}

// 主流程
async function main() {
  try {
    // 检查是否需要覆盖
    const shouldContinue = checkTargetDir();
    if (!shouldContinue) {
      console.log('❌ 已取消下载');
      process.exit(0);
    }
    
    await downloadModel();
    const success = validateDownload();
    
    if (success) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 模型下载成功！');
      console.log('='.repeat(60));
      console.log('\n✅ 下一步：使用本地模型启动服务');
      console.log('   npm run start:local');
      console.log('\n💡 说明：');
      console.log('   - 使用本地模型，启动速度更快');
      console.log('   - 无需网络连接，支持离线使用');
      console.log('   - 模型文件位于：./models/bge-small-zh-v1.5/');
    } else {
      console.error('\n❌ 下载不完整，请检查错误信息');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 下载过程出错:', error.message);
    process.exit(1);
  }
}

main();
