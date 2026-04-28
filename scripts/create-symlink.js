#!/usr/bin/env node

/**
 * 创建符号链接脚本
 * 在 node_modules/@xenova/transformers/models/ 下创建符号链接指向项目根目录的 models/
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const NODE_MODULES_MODELS = path.join(
  PROJECT_ROOT,
  'node_modules',
  '@xenova',
  'transformers',
  'models'
);
const LOCAL_MODELS = path.join(PROJECT_ROOT, 'models', 'bge-small-zh-v1.5');

// 需要创建多个符号链接，因为库可能使用不同的名称查找
const SYMLINK_NAMES = [
  'bge-small-zh-v1.5',           // 完整名称
  'BAAI/bge-small-zh-v1.5',      // 完整仓库名称
  'bge-small-zh'                 // 去掉版本名称
];

function createSymlink() {
  // 确保 node_modules/@xenova/transformers/models 目录存在
  if (!fs.existsSync(NODE_MODULES_MODELS)) {
    fs.mkdirSync(NODE_MODULES_MODELS, { recursive: true });
    console.log('创建目录:', NODE_MODULES_MODELS);
  }

  // 检查目标目录是否存在
  if (!fs.existsSync(LOCAL_MODELS)) {
    console.error('错误：目标目录不存在:', LOCAL_MODELS);
    console.error('请先运行：npm run download');
    process.exit(1);
  }

  // 为每个符号链接名称创建链接
  let successCount = 0;
  for (const name of SYMLINK_NAMES) {
    const SYMLINK_PATH = path.join(NODE_MODULES_MODELS, name);
    const parentDir = path.dirname(SYMLINK_PATH);
    
    // 创建父目录（如果不存在）
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    // 检查符号链接是否已存在
    if (fs.existsSync(SYMLINK_PATH)) {
      const stats = fs.lstatSync(SYMLINK_PATH);
      if (stats.isSymbolicLink()) {
        console.log(`✓ 符号链接已存在：${name} -> ${fs.readlinkSync(SYMLINK_PATH)}`);
        successCount++;
        continue;
      } else {
        // 不是符号链接，删除它
        console.log(`删除已存在的目录：${SYMLINK_PATH}`);
        fs.rmSync(SYMLINK_PATH, { recursive: true, force: true });
      }
    }
    
    // 创建符号链接
    try {
      fs.symlinkSync(LOCAL_MODELS, SYMLINK_PATH);
      console.log(`✓ 符号链接创建成功：${name} -> ${LOCAL_MODELS}`);
      successCount++;
    } catch (err) {
      console.error(`✗ 创建符号链接失败 (${name}):`, err.message);
    }
  }
  
  console.log(`\n总结：成功创建 ${successCount}/${SYMLINK_NAMES.length} 个符号链接`);
  
  if (successCount === 0) {
    process.exit(1);
  }
}

createSymlink();
