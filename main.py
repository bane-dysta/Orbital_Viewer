# main.py
import os
import sys
from serve import start_server

def get_resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)

def main():
    try:
        # 启动服务器，支持命令行输入
        start_server(port=8000)
    except Exception as e:
        print(f"错误: {str(e)}")
        input("按回车键退出...")
        sys.exit(1)

if __name__ == '__main__':
    main()