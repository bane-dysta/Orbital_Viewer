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
    # 移除开头的斜杠
    relative_path = relative_path.lstrip('/')
    
    # 移除路径中多余的 'static' 前缀
    if relative_path.startswith('static/'):
        relative_path = relative_path[7:]
    
    # 尝试的路径列表
    possible_paths = []
    
    # 基础路径列表
    base_paths = []
    
    # 1. 如果是打包环境且需要检查打包路径
    if check_meipass and getattr(sys, 'frozen', False):
        base_paths.append(sys._MEIPASS)
    
    # 2. 添加脚本所在目录
    base_paths.append(os.path.dirname(os.path.abspath(__file__)))
    
    # 3. 添加当前工作目录
    base_paths.append(os.getcwd())
    
    # 对每个基础路径，尝试不同的组合
    for base_path in base_paths:
        # 尝试直接在基础路径下查找
        possible_paths.append(os.path.join(base_path, relative_path))
        
        # 尝试在static子目录下查找
        possible_paths.append(os.path.join(base_path, 'static', relative_path))
        
        # 如果文件在js、css或lib子目录下
        for subdir in ['js', 'css', 'lib']:
            if subdir in relative_path:
                # 尝试完整路径
                possible_paths.append(os.path.join(base_path, 'static', relative_path))
                # 尝试不带static的路径
                possible_paths.append(os.path.join(base_path, relative_path))
    
    # 记录所有尝试的路径
    logging.debug(f"尝试查找文件 {relative_path} 的路径:")
    for path in possible_paths:
        logging.debug(f"- {path}")
    
    # 查找第一个存在的路径
    for path in possible_paths:
        if os.path.exists(path):
            logging.info(f"找到文件: {path}")
            return path
    
    # 如果都没找到，返回第一个可能的路径（用于错误处理）
    logging.warning(f"未找到文件 {relative_path}，将使用默认路径: {possible_paths[0]}")
    return possible_paths[0]

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
    default_settings = None
    
    def __init__(self, *args, **kwargs):
        if OrbitalViewerHandler.html_content is None:
            try:
                # 尝试多个可能的HTML文件名
                html_files = ['orbital_viewer.html', 'index.html']
                html_path = None
                
                for html_file in html_files:
                    path = get_resource_path(html_file)
                    if os.path.exists(path):
                        html_path = path
                        break
                
                if html_path is None:
                    raise FileNotFoundError("找不到HTML文件")
                
                logging.info(f"加载HTML文件: {html_path}")
                with open(html_path, 'rb') as f:
                    OrbitalViewerHandler.html_content = f.read().decode('utf-8')
            except Exception as e:
                logging.error(f"加载HTML文件失败: {e}")
                OrbitalViewerHandler.html_content = "Error loading HTML content"

        # 加载CSS内容
        if OrbitalViewerHandler.css_content is None:
            try:
                css_path = get_resource_path('css/styles.css')
                if not os.path.exists(css_path):
                    css_path = get_resource_path('styles.css')
                
                logging.info(f"加载CSS文件: {css_path}")
                with open(css_path, 'rb') as f:
                    OrbitalViewerHandler.css_content = f.read()
            except Exception as e:
                logging.error(f"加载CSS文件失败: {e}")
                OrbitalViewerHandler.css_content = b""

        # 加载JS内容
        if OrbitalViewerHandler.js_content is None:
            try:
                js_files = ['js/index.js', 'orbital-viewer.js']
                js_path = None
                
                for js_file in js_files:
                    path = get_resource_path(js_file)
                    if os.path.exists(path):
                        js_path = path
                        break
                
                if js_path is None:
                    raise FileNotFoundError("找不到JS文件")
                
                logging.info(f"加载JS文件: {js_path}")
                with open(js_path, 'rb') as f:
                    OrbitalViewerHandler.js_content = f.read()
            except Exception as e:
                logging.error(f"加载JS文件失败: {e}")
                OrbitalViewerHandler.js_content = b""

        if OrbitalViewerHandler.default_settings is None:
            OrbitalViewerHandler.default_settings = load_default_settings()
            
        super().__init__(*args, **kwargs)

    def do_GET(self):
        try:
            path = unquote(self.path)
            logging.info(f"收到请求: {path}")
            
            # 处理根路径请求
            if path == '/' or path == '/index.html':
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

            # 处理配置加载请求
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

            # 处理静态文件请求
            if path.startswith('/static/') or path.startswith('/css/') or path.startswith('/js/') or path.startswith('/lib/'):
                # 移除开头的斜杠
                file_path = path.lstrip('/')
                
                # 如果路径以css/、js/或lib/开头，添加static/前缀
                if any(file_path.startswith(prefix) for prefix in ['css/', 'js/', 'lib/']):
                    file_path = f"static/{file_path}"
                
                resource_path = get_resource_path(file_path)
                logging.info(f"尝试加载静态文件: {resource_path}")
                
                if os.path.exists(resource_path):
                    content_type = self.guess_content_type(resource_path)
                    with open(resource_path, 'rb') as f:
                        content = f.read()
                        self.send_response(200)
                        self.send_header('Content-type', content_type)
                        self.end_headers()
                        self.wfile.write(content)
                        return
                else:
                    logging.error(f"文件未找到: {resource_path}")
                    self.send_error(404, f"File not found: {file_path}")
                    return

            # 处理其他文件请求
            if path.startswith('/'):
                file_path = path.lstrip('/')
                if os.path.exists(file_path):
                    content_type = self.guess_content_type(file_path)
                    with open(file_path, 'rb') as f:
                        content = f.read()
                        self.send_response(200)
                        self.send_header('Content-type', content_type)
                        self.end_headers()
                        self.wfile.write(content)
                        return
                else:
                    logging.error(f"文件未找到: {file_path}")
                    self.send_error(404, f"File not found: {file_path}")
                    return

            super().do_GET()
            
        except Exception as e:
            logging.error(f"处理请求时出错: {e}")
            self.send_error(500, f"Internal Server Error: {str(e)}")

    def guess_content_type(self, path):
        """根据文件扩展名猜测内容类型"""
        ext = os.path.splitext(path)[1].lower()
        content_types = {
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
            '.json': 'application/json',
            '.cub': 'application/octet-stream',
            '.cube': 'application/octet-stream',
            '.ico': 'image/x-icon',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif'
        }
        return content_types.get(ext, 'application/octet-stream')

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