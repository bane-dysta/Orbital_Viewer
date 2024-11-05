import os
import sys
import shutil
import tempfile
from serve import start_server

def get_resource_path(relative_path):
    """获取资源文件路径，适用于开发环境和打包后的环境"""
    if getattr(sys, 'frozen', False):
        # 如果是打包后的可执行文件
        base_path = sys._MEIPASS
    else:
        # 如果是直接运行脚本
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)

def main():
    try:
        # 创建一个临时目录来存储程序文件
        temp_dir = tempfile.mkdtemp(prefix='orbital_viewer_')
        
        # 获取HTML文件路径
        html_source = get_resource_path('orbital_viewer.html')
        html_dest = os.path.join(temp_dir, 'orbital_viewer.html')
        
        # 复制HTML文件到临时目录
        shutil.copy2(html_source, html_dest)
        
        # 启动服务器
        start_server(port=8000)
        
    except Exception as e:
        print(f"错误: {str(e)}")
        input("按回车键退出...")
        sys.exit(1)
    finally:
        # 清理临时文件
        if 'temp_dir' in locals():
            try:
                shutil.rmtree(temp_dir)
            except:
                pass

if __name__ == '__main__':
    main()