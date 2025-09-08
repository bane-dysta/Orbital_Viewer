# main.py
import os
import sys
import time
from serve import start_viewer_server
import logging
import argparse

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def clear_screen():
    """清屏"""
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    """打印程序头部"""
    print("=" * 50)
    print("        轨道查看器 (Orbital Viewer) by wcy")
    print("=" * 50)
    print()

def print_menu():
    """打印菜单选项"""
    print("1. 快速启动")
    print("2. 加载JSON配置文件")
    print("3. 生成JSON配置文件")
    print("4. 帮助信息")
    print("5. 退出程序")
    print("\nTips：直接输入 .json 文件路径可快速启动配置")
    print()

def show_help():
    """显示帮助信息"""
    clear_screen()
    print_header()
    print("简单帮助信息：")
    print("-" * 30)
    print("• 快速启动：直接启动查看器，可拖拽 .cube/.cub 文件到查看器窗口")
    print("• 配置模式：通过 JSON 配置文件加载预设的轨道数据，需要对应 cub 文件与 JSON 配置文件在同一目录下")
    print("• 生成配置：输入包含cub文件的文件夹路径，按照默认设置生成 JSON 配置文件")
    print("• 访问 https://bane-dysta.github.io/posts/OViewer/ 获取详细介绍")
    print("\n按回车键返回主菜单...")
    input()

def generate_config_file():
    """生成配置文件"""
    clear_screen()
    print_header()
    print("请输入要生成配置的文件夹路径：")
    print("(输入 'back' 返回主菜单)\n")
    
    folder_path = input("> ").strip()
    
    if folder_path.lower() == 'back':
        return
        
    if not os.path.exists(folder_path):
        print("\n错误：文件夹不存在")
        time.sleep(2)
        return
        
    try:
        from config_write import write_config
        config_path = write_config(folder_path)
        print(f"\n配置文件已生成: {config_path}")
        print("\n是否立即加载该配置？(y/n)")
        if input().lower().strip() == 'y':
            start_viewer_server(config_path)
    except Exception as e:
        print(f"\n生成配置文件时出错: {str(e)}")
    
    print("\n按回车键继续...")
    input()

def process_config_path(path):
    """处理配置文件路径"""
    if not path.endswith('.json'):
        print("\n错误：请选择 JSON 配置文件")
        time.sleep(2)
        return False
        
    if not os.path.exists(path):
        print("\n错误：文件不存在")
        time.sleep(2)
        return False
    
    return True

def parse_command_line():
    """解析命令行参数，支持与quick_start相同的功能"""
    parser = argparse.ArgumentParser(description='轨道查看器')
    parser.add_argument('-c', '--config', 
                       help='指定要加载的JSON配置文件路径')
    parser.add_argument('-s', '--silent', action='store_true',
                       help='静默模式，不显示欢迎信息')
    
    return parser.parse_args()

def main():
    # 解析命令行参数
    args = parse_command_line()
    
    # 如果提供了命令行参数，以无交互模式运行
    if args.config or args.silent:
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
                return 0
            else:
                # 无配置文件模式启动
                logging.info("以默认模式启动轨道查看器...")
                start_viewer_server()
                return 0
                
        except KeyboardInterrupt:
            logging.info("程序被中断，正在退出...")
            return 1
        except Exception as e:
            logging.error(f"启动过程中发生错误: {str(e)}")
            return 1
    
    # 如果没有命令行参数，以交互模式运行
    while True:
        try:
            clear_screen()
            print_header()
            print_menu()
            
            choice = input("请选择操作 (1-5) : ").strip()
            
            # 检查是否直接输入了json路径
            if choice.endswith('.json'):
                if process_config_path(choice):
                    start_viewer_server(choice)
                continue
            
            if choice == '1':
                # 快速启动
                clear_screen()
                print_header()
                print("正在启动服务器...\n")
                start_viewer_server()
            
            elif choice == '2':
                # 加载配置
                clear_screen()
                print_header()
                print("请输入配置文件的完整路径：")
                print("(输入 'back' 返回主菜单)\n")
                config_path = input("> ").strip()
                
                if config_path.lower() == 'back':
                    continue
                
                if process_config_path(config_path):
                    start_viewer_server(config_path)

            elif choice == '3':  
                # 生成配置文件
                generate_config_file()      
            
            elif choice == '4':
                # 显示帮助
                show_help()
            
            elif choice == '5':
                # 退出程序
                clear_screen()
                print_header()
                print("感谢使用！再见！")
                time.sleep(1)
                sys.exit(0)
            
            else:
                print("\n无效的选择，请重试...")
                time.sleep(1)
                
        except KeyboardInterrupt:
            clear_screen()
            print_header()
            print("程序被中断，正在退出...")
            time.sleep(1)
            sys.exit(1)
        except Exception as e:
            print(f"\n发生错误: {str(e)}")
            print("按回车键继续...")
            input()

if __name__ == '__main__':
    main()