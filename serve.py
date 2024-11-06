# serve.py
import os
import sys
import json
import shutil
import http.server
import socketserver
import webbrowser
from pathlib import Path
from urllib.parse import unquote
import logging
import threading

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def get_resource_path(relative_path):
    """获取资源文件路径，适用于开发环境和打包后的环境"""
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

class OrbitalViewerHandler(http.server.SimpleHTTPRequestHandler):
    html_content = None  # 缓存HTML内容
    
    def __init__(self, *args, **kwargs):
        if OrbitalViewerHandler.html_content is None:
            try:
                html_path = get_resource_path('orbital_viewer.html')
                with open(html_path, 'rb') as f:
                    OrbitalViewerHandler.html_content = f.read().decode('utf-8')
            except Exception as e:
                logging.error(f"加载HTML文件失败: {e}")
                OrbitalViewerHandler.html_content = "Error loading HTML content"
        super().__init__(*args, **kwargs)

    def do_GET(self):
        try:
            path = unquote(self.path)
            
            # 处理主页请求
            if path.startswith('/?config='):
                config_name = unquote(path.split('=')[1])
                logging.info(f"加载配置文件: {config_name}")
                
                # 读取配置文件
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

                # 注入配置信息
                init_script = f"""
                <script>
                    window.ORBITAL_VIEWER_CONFIG = {{
                        configPath: '{config_name}',
                        configData: {json.dumps(config_data)}
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

def start_server(port=8000):
    """启动服务器"""
    try:
        # 等待用户输入配置文件路径
        while True:
            path = input("\n请输入配置文件路径（输入 'exit' 退出）: ").strip()
            
            if path.lower() == 'exit':
                logging.info("程序即将退出...")
                sys.exit(0)
            
            if not path:
                continue

            # 将路径转换为绝对路径
            path = os.path.abspath(path)
            
            if not os.path.exists(path):
                logging.error(f"文件不存在: {path}")
                continue
                
            if not path.endswith('.json'):
                logging.error("请输入 JSON 配置文件路径")
                continue

            # 切换到配置文件所在目录
            json_dir = os.path.dirname(path)
            os.chdir(json_dir)
            logging.info(f"工作目录已切换到: {json_dir}")

            # 获取配置文件名
            json_name = os.path.basename(path)
            
            # 尝试启动服务器
            while port < 8100:
                try:
                    httpd = ThreadedHTTPServer(("", port), OrbitalViewerHandler)
                    logging.info(f"服务器启动在: http://localhost:{port}")
                    
                    # 打开浏览器，使用文件名访问配置
                    url = f'http://localhost:{port}/?config={json_name}'
                    logging.info(f"正在打开: {url}")
                    webbrowser.open(url)
                    
                    # 运行服务器
                    httpd.serve_forever()
                    
                except OSError:
                    logging.warning(f"端口 {port} 被占用，尝试下一个端口")
                    port += 1
                except Exception as e:
                    logging.error(f"启动服务器时出错: {str(e)}")
                    break
                    
    except KeyboardInterrupt:
        logging.info("用户中断，程序退出...")
    except Exception as e:
        logging.error(f"程序出错: {str(e)}")
    finally:
        sys.exit(0)

if __name__ == "__main__":
    start_server()