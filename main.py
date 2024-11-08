# main.py
import os
import sys
import time
from serve import start_viewer_server
import logging

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
    print("2. 加载配置文件")
    print("3. 生成配置文件")  # 新添加的选项
    print("4. 帮助信息")
    print("5. 退出程序")
    print("\nTips：直接输入 .json 文件路径可快速启动配置")
    print()

def show_help():
    """显示帮助信息"""
    clear_screen()
    print_header()
    print("帮助信息：")
    print("-" * 30)
    print("• 无配置模式：直接启动查看器，可拖拽 .cube/.cub 文件到界面中")
    print("• 配置模式：通过 JSON 配置文件加载预设的轨道数据")
    print("• 支持同时查看多个轨道")
    print("• 可以调整等值面、颜色等参数")
    print("• 支持截图功能")
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

def main():
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