import os
import sys
import json
import shutil
import socket
import http.server
import socketserver
import webbrowser
from pathlib import Path
from urllib.parse import unquote
import logging
import threading

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def load_default_settings():
    """加载默认设置"""
    default_settings = {
        "color1": "#0000FF",
        "color2": "#FF0000",
        "isoValue": "0.002",
        "surfaceScale": "2.0",
        "showPositive": True
    }
    
    try:
        default_path = os.path.join(os.path.dirname(__file__), 'default.txt')
        if not os.path.exists(default_path):
            return default_settings
            
        with open(default_path, 'r', encoding='utf-8') as f:
            custom_settings = json.load(f)
            # 合并默认设置和自定义设置
            default_settings.update(custom_settings)
            
        logging.info(f"已加载自定义默认设置: {default_settings}")
    except Exception as e:
        logging.warning(f"加载默认设置失败，使用内置默认值: {str(e)}")
    
    return default_settings



def find_available_port(start_port=8000, max_port=8999):
    """查找可用的端口"""
    for port in range(start_port, max_port + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            continue
    raise RuntimeError("未找到可用端口")

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

class OrbitalViewerHandler(http.server.SimpleHTTPRequestHandler):
    html_content = None  # 缓存HTML内容
    default_settings = None  # 添加默认设置属性
    
    def __init__(self, *args, **kwargs):
        if OrbitalViewerHandler.html_content is None:
            try:
                html_path = get_resource_path('orbital_viewer.html')
                with open(html_path, 'rb') as f:
                    OrbitalViewerHandler.html_content = f.read().decode('utf-8')
            except Exception as e:
                logging.error(f"加载HTML文件失败: {e}")
                OrbitalViewerHandler.html_content = "Error loading HTML content"
                
        if OrbitalViewerHandler.default_settings is None:
            OrbitalViewerHandler.default_settings = load_default_settings()
            
        super().__init__(*args, **kwargs)

    def do_GET(self):
        try:
            path = unquote(self.path)
            
            # 处理主页请求
            if path.startswith('/?config='):
                config_name = unquote(path.split('=')[1])
                logging.info(f"加载配置文件: {config_name}")
                
                try:
                    with open(config_name, 'r', encoding='utf-8') as f:
                        config_data = json.load(f)
                except Exception as e:
                    logging.error(f"读取配置文件失败: {e}")
                    self.send_error(500, f"无法读取配置文件: {str(e)}")
                    return

                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()

                # 注入配置信息和默认设置
                init_script = f"""
                <script>
                    window.ORBITAL_VIEWER_CONFIG = {{
                        configPath: '{config_name}',
                        configData: {json.dumps(config_data)},
                        defaultSettings: {json.dumps(OrbitalViewerHandler.default_settings)}
                    }};
                </script>
                """
                modified_content = OrbitalViewerHandler.html_content.replace('</head>', f'{init_script}</head>')
                self.wfile.write(modified_content.encode('utf-8'))
                return

            elif path == '/' or path == '/index.html':
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                
                # 注入默认设置
                init_script = f"""
                <script>
                    window.ORBITAL_VIEWER_CONFIG = {{
                        defaultSettings: {json.dumps(OrbitalViewerHandler.default_settings)}
                    }};
                </script>
                """
                modified_content = OrbitalViewerHandler.html_content.replace('</head>', f'{init_script}</head>')
                self.wfile.write(modified_content.encode('utf-8'))
                return

            elif path == '/' or path == '/index.html':
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(OrbitalViewerHandler.html_content.encode('utf-8'))
                return

            # 处理其他文件请求
            if path.startswith('/'):
                file_path = path.lstrip('/')
                if os.path.exists(file_path):
                    self.send_file(file_path)
                    return
                else:
                    logging.error(f"文件未找到: {file_path}")
                    self.send_error(404, f"File not found: {file_path}")
                    return
            
            super().do_GET()
            
        except Exception as e:
            logging.error(f"处理请求时出错: {e}")
            self.send_error(500, f"Internal Server Error: {str(e)}")

    def send_file(self, filepath):
        try:
            with open(filepath, 'rb') as f:
                self.send_response(200)
                if filepath.endswith('.json'):
                    self.send_header('Content-type', 'application/json')
                elif filepath.endswith(('.cub', '.cube')):
                    self.send_header('Content-type', 'application/octet-stream')
                self.end_headers()
                shutil.copyfileobj(f, self.wfile)
                logging.info(f"成功发送文件: {filepath}")
        except Exception as e:
            logging.error(f"发送文件时出错: {filepath} - {e}")
            self.send_error(404, f"File not found: {filepath}")

def get_resource_path(relative_path):
    """获取资源文件路径，适用于开发环境和打包后的环境"""
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)


def start_viewer_server(config_path=None):
    """启动查看器服务器"""
    try:
        # 查找可用端口
        port = find_available_port()
        logging.info(f"找到可用端口: {port}")

        # 如果提供了配置文件，切换到配置文件所在目录
        if config_path:
            json_dir = os.path.dirname(os.path.abspath(config_path))
            os.chdir(json_dir)
            json_name = os.path.basename(config_path)
            logging.info(f"工作目录已切换到: {json_dir}")
        else:
            os.chdir(os.getcwd())
            logging.info(f"无配置模式启动，工作目录: {os.getcwd()}")

        try:
            httpd = ThreadedHTTPServer(("", port), OrbitalViewerHandler)
            logging.info(f"服务器启动在: http://localhost:{port}")
            
            # 构建URL
            if config_path:
                url = f'http://localhost:{port}/?config={json_name}'
            else:
                url = f'http://localhost:{port}/'
            
            logging.info(f"正在打开: {url}")
            webbrowser.open(url)
            
            # 运行服务器
            httpd.serve_forever()
                
        except Exception as e:
            logging.error(f"启动服务器时出错: {str(e)}")
                
    except KeyboardInterrupt:
        logging.info("服务器已停止...")
    except Exception as e:
        logging.error(f"发生错误: {str(e)}")

if __name__ == "__main__":
    start_viewer_server()