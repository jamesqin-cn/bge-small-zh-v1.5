const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { v4: uuidv4 } = require('uuid');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length > 0 
      ? ` ${JSON.stringify(meta)}` 
      : '';
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length > 0 
      ? ` ${JSON.stringify(meta)}` 
      : '';
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

// 处理循环引用的 replacer 函数
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[循环引用]';
      }
      seen.add(value);
    }
    return value;
  };
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new DailyRotateFile({ 
      filename: 'logs/%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: 5242880,
      maxFiles: '14d'
    })
  ],
  // 禁用默认的错误堆栈输出，避免重复
  exitOnError: false
});

// 始终启用控制台输出（使用相同的格式）
logger.add(new winston.transports.Console({
  format: consoleFormat,
  // 立即输出，不缓冲
  handleExceptions: true,
  handleRejections: true
}));

function generateRequestId() {
  return uuidv4().substring(0, 8);
}

module.exports = { logger, generateRequestId };
