# 基础镜像
FROM node:24-slim

# 设置时区为东八区（Asia/Shanghai）并安装依赖
ENV TZ=Asia/Shanghai
RUN apt-get update && apt-get install -y tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 工作目录
WORKDIR /app

# 复制依赖文件
COPY --chown=node:node package*.json ./

# 安装依赖
RUN chown -R node:node /app && npm install --omit=dev

# 复制项目全部代码
COPY --chown=node:node . .

# 复制入口脚本
COPY --chown=node:node docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# 暴露端口
EXPOSE 7078

# 使用入口脚本启动
ENTRYPOINT ["./docker-entrypoint.sh"]
