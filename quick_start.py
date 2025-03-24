# quick_start.py
import os
import sys
import logging
import argparse
from serve import start_viewer_server

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def print_header():
    """打印程序头部"""
    print("=" * 50)
    print("        轨道查看器 (Orbital Viewer) by wcy")
    print("=" * 50)
    print()

def main():
    """无交互启动轨道查看器"""
    parser = argparse.ArgumentParser(description='轨道查看器快速启动工具')
    parser.add_argument('-c', '--config', 
                        help='指定要加载的JSON配置文件路径')
    parser.add_argument('-s', '--silent', action='store_true',
                        help='静默模式，不显示欢迎信息')
    
    args = parser.parse_args()
    
    if not args.silent:
        print_header()
    
    try:
        if args.config:
            # 检查文件是否存在且是JSON格式
            if not os.path.exists(args.config):
                logging.error(f"配置文件不存在: {args.config}")
                return 1
                
            if not args.config.endswith('.json'):
                logging.error(f"配置文件必须是JSON格式: {args.config}")
                return 1
                
            logging.info(f"正在加载配置文件: {args.config}")
            start_viewer_server(args.config)
        else:
            # 无配置文件模式启动
            logging.info("以默认模式启动轨道查看器...")
            start_viewer_server()
            
    except KeyboardInterrupt:
        logging.info("程序被中断，正在退出...")
        return 1
    except Exception as e:
        logging.error(f"启动过程中发生错误: {str(e)}")
        return 1
        
    return 0

if __name__ == "__main__":
    sys.exit(main()) 