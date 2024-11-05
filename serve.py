import os
import sys
import json
import shutil
import http.server
import socketserver
import webbrowser
from pathlib import Path
from urllib.parse import unquote
import tempfile
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def get_resource_path(relative_path):
    """获取资源文件路径，适用于开发环境和打包后的环境"""
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)

class OrbitalViewerHandler(http.server.SimpleHTTPRequestHandler):
    temp_dir = None      # 临时目录路径
    working_dir = None   # 当前工作目录
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        try:
            path = unquote(self.path)
            
            # 处理主页请求
            if path == '/' or path == '/index.html':
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                # 从资源目录读取HTML文件
                html_path = get_resource_path('orbital_viewer.html')
                with open(html_path, 'rb') as f:
                    self.wfile.write(f.read())
                return

            # 处理.cub文件请求
            if path.endswith(('.cub', '.cube')):
                file_name = os.path.basename(path)
                
                # 首先在临时目录中查找
                temp_path = os.path.join(self.temp_dir, file_name)
                if os.path.exists(temp_path):
                    self.send_file(temp_path)
                    return
                
                # 然后在工作目录中查找
                work_path = os.path.join(self.working_dir, file_name)
                if os.path.exists(work_path):
                    # 复制到临时目录
                    shutil.copy2(work_path, temp_path)
                    self.send_file(temp_path)
                    return
                
                # 找不到文件
                self.send_error(404, f"File not found: {file_name}")
                return
            
            # 其他请求使用默认处理
            super().do_GET()
            
        except Exception as e:
            logging.error(f"处理请求时出错: {e}")
            self.send_error(500, f"Internal Server Error: {str(e)}")

    def send_file(self, filepath):
        """发送文件到客户端"""
        try:
            with open(filepath, 'rb') as f:
                self.send_response(200)
                if filepath.endswith('.json'):
                    self.send_header('Content-type', 'application/json')
                elif filepath.endswith(('.cub', '.cube')):
                    self.send_header('Content-type', 'application/octet-stream')
                self.end_headers()
                shutil.copyfileobj(f, self.wfile)
        except Exception as e:
            logging.error(f"发送文件时出错: {e}")
            self.send_error(404, f"File not found: {filepath}")

def start_server(port=8000):
    """启动服务器"""
    # 创建临时目录
    temp_dir = tempfile.mkdtemp(prefix='orbital_viewer_')
    logging.info(f"创建临时目录: {temp_dir}")
    
    # 设置处理器的目录
    OrbitalViewerHandler.temp_dir = temp_dir
    OrbitalViewerHandler.working_dir = os.getcwd()
    
    try:
        # 启动服务器
        while port < 8100:
            try:
                with socketserver.TCPServer(("", port), OrbitalViewerHandler) as httpd:
                    logging.info(f"服务器启动在: http://localhost:{port}")
                    webbrowser.open(f'http://localhost:{port}')
                    httpd.serve_forever()
            except OSError:
                logging.warning(f"端口 {port} 被占用，尝试下一个端口")
                port += 1
            except Exception as e:
                logging.error(f"启动服务器时出错: {str(e)}")
                break
    finally:
        # 清理临时目录
        try:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        except:
            pass