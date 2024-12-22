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

def get_local_ip():
    """获取本机的局域网IP地址"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 不需要真实连接
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def get_resource_path(relative_path, check_meipass=True):
    """获取资源文件路径，适用于开发环境和打包后的环境
    
    Args:
        relative_path: 相对路径
        check_meipass: 是否检查打包环境路径，对于 default.txt 这种不打包的文件应该设为 False
    """
    if check_meipass and getattr(sys, 'frozen', False):
        # 如果是打包后的环境且需要检查打包路径
        base_path = sys._MEIPASS
    else:
        # 开发环境或不检查打包路径 - 使用当前脚本所在目录
        base_path = os.path.dirname(os.path.abspath(__file__))
    
    # 移除路径中多余的 'static' 前缀
    if relative_path.startswith('static/'):
        relative_path = relative_path[7:]

    # 首先尝试在 static 目录下查找
    static_path = os.path.join(base_path, 'static', relative_path)
    if os.path.exists(static_path):
        return static_path
        
    # 如果不在 static 目录下，则尝试在根目录下查找
    root_path = os.path.join(base_path, relative_path)
    if os.path.exists(root_path):
        return root_path
        
    # 如果是不检查打包路径的情况，还要尝试程序运行目录
    if not check_meipass:
        current_dir_path = os.path.join(os.getcwd(), relative_path)
        if os.path.exists(current_dir_path):
            return current_dir_path
        
    # 添加日志输出来诊断路径问题
    logging.info(f"尝试加载资源文件: {static_path} 或 {root_path}")
    return static_path  # 返回 static_path 以保持一致的错误处理

def parse_default_file(file_content):
    """解析默认配置文件"""
    settings = {}
    for line in file_content.splitlines():
        # 跳过空行和注释行
        line = line.strip()
        if not line or line.startswith('#'):
            continue
            
        try:
            # 分割键值对
            if '=' in line:
                key, value = [x.strip() for x in line.split('=', 1)]
                
                # 处理布尔值
                if value.lower() == 'true':
                    value = True
                elif value.lower() == 'false':
                    value = False
                    
                settings[key] = value
        except Exception as e:
            logging.warning(f"解析配置行失败: {line}, 错误: {str(e)}")
            continue
            
    return settings

def load_default_settings():
    """加载默认设置"""
    default_settings = {
        "color1": "#0000FF",
        "color2": "#FF0000",
        "isoValue": "0.002",
        "surfaceScale": "1.0",
        "showPositive": True
    }
    
    try:
        # 修改这里：不使用 get_resource_path，而是直接尝试多个可能的路径
        possible_paths = [
            os.path.join(os.getcwd(), 'default.txt'),  # 当前工作目录
            os.path.join(os.path.dirname(os.path.abspath(__file__)), 'default.txt'),  # 脚本所在目录
        ]
        
        default_file = None
        default_path = None
        
        # 尝试所有可能的路径
        for path in possible_paths:
            if os.path.exists(path):
                default_path = path
                break
                
        if not default_path:
            logging.info("未找到默认配置文件，使用内置默认值")
            return default_settings
            
        with open(default_path, 'r', encoding='utf-8') as f:
            custom_settings = parse_default_file(f.read())
            
            # 验证并转换数值
            if 'isoValue' in custom_settings:
                try:
                    float(custom_settings['isoValue'])  # 验证是否为有效数字
                except ValueError:
                    logging.warning(f"无效的等值面值: {custom_settings['isoValue']}, 使用默认值")
                    custom_settings.pop('isoValue')
                    
            if 'surfaceScale' in custom_settings:
                try:
                    float(custom_settings['surfaceScale'])  # 验证是否为有效数字
                except ValueError:
                    logging.warning(f"无效的缩放值: {custom_settings['surfaceScale']}, 使用默认值")
                    custom_settings.pop('surfaceScale')
                    
            # 验证颜色格式
            for color_key in ['color1', 'color2']:
                if color_key in custom_settings:
                    color = custom_settings[color_key]
                    if not color.startswith('#') or len(color) != 7:
                        logging.warning(f"无效的颜色格式: {color}, 使用默认值")
                        custom_settings.pop(color_key)
            
            # 合并默认设置和自定义设置
            default_settings.update(custom_settings)
            logging.info(f"已加载自定义默认设置: {custom_settings}")
            
    except Exception as e:
        logging.warning(f"加载默认设置失败，使用内置默认值: {str(e)}")
    
    return default_settings

def find_available_port(start_port=8000, max_port=8999):
    """查找可用的端口"""
    for port in range(start_port, max_port + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                # 明确绑定到所有接口
                s.bind(('0.0.0.0', port))
                return port
        except OSError:
            continue
    raise RuntimeError("未找到可用端口")

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

class OrbitalViewerHandler(http.server.SimpleHTTPRequestHandler):
    html_content = None
    css_content = None
    js_content = None
    screenshot_js_content = None
    default_settings = None
    
    def __init__(self, *args, **kwargs):
        if OrbitalViewerHandler.html_content is None:
            try:
                html_path = get_resource_path('orbital_viewer.html')
                logging.info(f"正在加载HTML文件: {html_path}")
                if not os.path.exists(html_path):
                    logging.error(f"HTML文件不存在: {html_path}")
                    alternative_path = os.path.join(os.path.dirname(__file__), 'orbital_viewer.html')
                    logging.info(f"尝试备选路径: {alternative_path}")
                    if os.path.exists(alternative_path):
                        html_path = alternative_path

                with open(html_path, 'rb') as f:
                    OrbitalViewerHandler.html_content = f.read().decode('utf-8')
            except Exception as e:
                logging.error(f"加载HTML文件失败: {e}")
                OrbitalViewerHandler.html_content = "Error loading HTML content"

        # 加载CSS内容
        if OrbitalViewerHandler.css_content is None:
            try:
                css_path = get_resource_path('styles.css')
                logging.info(f"正在加载CSS文件: {css_path}")
                if not os.path.exists(css_path):
                    logging.error(f"CSS文件不存在: {css_path}")
                    alternative_path = os.path.join(os.path.dirname(__file__), 'styles.css')
                    logging.info(f"尝试备选路径: {alternative_path}")
                    if os.path.exists(alternative_path):
                        css_path = alternative_path
                
                with open(css_path, 'rb') as f:
                    OrbitalViewerHandler.css_content = f.read()
            except Exception as e:
                logging.error(f"加载CSS文件失败: {e}")
                OrbitalViewerHandler.css_content = b""

        if OrbitalViewerHandler.js_content is None:
            try:
                js_path = get_resource_path('orbital-viewer.js')
                logging.info(f"正在加载JS文件: {js_path}")
                if not os.path.exists(js_path):
                    logging.error(f"JS文件不存在: {js_path}")
                    alternative_path = os.path.join(os.path.dirname(__file__), 'orbital-viewer.js')
                    logging.info(f"尝试备选路径: {alternative_path}")
                    if os.path.exists(alternative_path):
                        js_path = alternative_path
                
                with open(js_path, 'rb') as f:
                    OrbitalViewerHandler.js_content = f.read()
            except Exception as e:
                logging.error(f"加载JS文件失败: {e}")
                OrbitalViewerHandler.js_content = b""

        if OrbitalViewerHandler.screenshot_js_content is None:
            try:
                js_path = get_resource_path('screenshot.js')
                logging.info(f"正在加载 Screenshot JS 文件: {js_path}")
                if not os.path.exists(js_path):
                    logging.error(f"Screenshot JS 文件不存在: {js_path}")
                    alternative_path = os.path.join(os.path.dirname(__file__), 'screenshot.js')
                    logging.info(f"尝试备选路径: {alternative_path}")
                    if os.path.exists(alternative_path):
                        js_path = alternative_path
                
                with open(js_path, 'rb') as f:
                    OrbitalViewerHandler.screenshot_js_content = f.read()
            except Exception as e:
                logging.error(f"加载 Screenshot JS 文件失败: {e}")
                OrbitalViewerHandler.screenshot_js_content = b""

        if OrbitalViewerHandler.default_settings is None:
            OrbitalViewerHandler.default_settings = load_default_settings()
            
        super().__init__(*args, **kwargs)

    def do_GET(self):
        try:
            path = unquote(self.path)
            
            # 处理 static 目录下的文件请求
            if path.startswith('/static/'):
                file_name = os.path.basename(path)  # 获取文件名
                if file_name == 'styles.css':
                    self.send_response(200)
                    self.send_header('Content-type', 'text/css')
                    self.end_headers()
                    self.wfile.write(OrbitalViewerHandler.css_content)
                    return
                elif file_name == 'orbital-viewer.js':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/javascript')
                    self.end_headers()
                    self.wfile.write(OrbitalViewerHandler.js_content)
                    return
                elif file_name in ['3Dmol-min.js', 'jquery.min.js']:
                    try:
                        file_path = get_resource_path(file_name)
                        with open(file_path, 'rb') as f:
                            content = f.read()
                            self.send_response(200)
                            self.send_header('Content-type', 'application/javascript')
                            self.end_headers()
                            self.wfile.write(content)
                            return
                    except Exception as e:
                        logging.error(f"加载文件失败 {file_name}: {e}")
                        self.send_error(404, f"File not found: {file_name}")
                        return
                elif file_name == 'screenshot.js':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/javascript')
                    self.end_headers()
                    self.wfile.write(OrbitalViewerHandler.screenshot_js_content)
                    return

            # 处理CSS文件请求
            if path == '/styles.css':
                self.send_response(200)
                self.send_header('Content-type', 'text/css')
                self.end_headers()
                self.wfile.write(OrbitalViewerHandler.css_content)
                return

            if path == '/orbital-viewer.js' or path == '/static/orbital-viewer.js':
                self.send_response(200)
                self.send_header('Content-type', 'application/javascript')
                self.end_headers()
                self.wfile.write(OrbitalViewerHandler.js_content)
                return

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

def start_viewer_server(config_path=None):
    """启动查看器服务器"""
    try:
        # 查找可用端口
        port = find_available_port()
        
        # 获取本机IP地址
        local_ip = get_local_ip()
        logging.info(f"找到可用端口: {port}")
        logging.info(f"本机IP地址: {local_ip}")

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
            # 明确绑定到所有接口
            httpd = ThreadedHTTPServer(("0.0.0.0", port), OrbitalViewerHandler)
            logging.info(f"本地访问地址: http://localhost:{port}")
            logging.info(f"局域网访问地址: http://{local_ip}:{port}")
            
            # 构建URL
            if config_path:
                url = f'http://localhost:{port}/?config={json_name}'
            else:
                url = f'http://localhost:{port}/'
            
            logging.info(f"正在浏览器中打开本地地址...")
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