# 使用Python 3.9的slim版本作为基础镜像
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 安装必要的系统依赖
RUN apt-get update && apt-get install -y \
    xclip \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY main.py .
COPY serve.py .
COPY config_write.py .
COPY orbital-viewer.js ./static/
COPY styles.css ./static/
COPY orbital_viewer.html ./static/
COPY default.txt .

# 安装Python依赖
RUN pip install --no-cache-dir \
    http-server \
    webbrowser \
    pathlib

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Shanghai

# 暴露端口
EXPOSE 8000-8999

# 设置启动命令
CMD ["python", "main.py"]