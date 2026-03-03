from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

from .config_gen import write_config
from .server import start_viewer_server
from .utils import setup_logging

logger = logging.getLogger(__name__)


def clear_screen() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def print_header() -> None:
    print("=" * 50)
    print("        轨道查看器 (Orbital Viewer) by wcy")
    print("=" * 50)
    print()


def print_menu() -> None:
    print("1. 快速启动")
    print("2. 加载JSON配置文件")
    print("3. 生成JSON配置文件")
    print("4. 帮助信息")
    print("5. 退出程序")
    print("\nTips：直接输入 .json 文件路径可快速启动配置")
    print()


def show_help() -> None:
    clear_screen()
    print_header()
    print("简单帮助信息：")
    print("-" * 30)
    print("• 快速启动：直接启动查看器，可拖拽 .cube/.cub 文件到查看器窗口")
    print("• 配置模式：通过 JSON 配置文件加载预设的轨道数据，需要对应 cub 文件与 JSON 配置文件在同一目录下")
    print("• 生成配置：输入包含 cub/cube 文件的文件夹路径，按照默认规则生成 JSON 配置文件")
    print("• 访问 https://bane-dysta.github.io/posts/OViewer/ 获取详细介绍")
    print("\n按回车键返回主菜单...")
    input()


def _validate_config_path(path: str) -> Path:
    p = Path(path).expanduser()
    if p.suffix.lower() != ".json":
        raise ValueError("请选择 JSON 配置文件")
    if not p.exists():
        raise FileNotFoundError("文件不存在")
    return p.resolve()


def generate_config_file_interactive() -> None:
    clear_screen()
    print_header()
    print("请输入要生成配置的文件夹路径：")
    print("(输入 'back' 返回主菜单)\n")

    folder_path = input("> ").strip()
    if folder_path.lower() == "back":
        return

    folder = Path(folder_path).expanduser()
    if not folder.exists():
        print("\n错误：文件夹不存在")
        time.sleep(2)
        return

    try:
        config_path = write_config(folder)
        print(f"\n配置文件已生成: {config_path}")
        print("\n是否立即加载该配置？(y/n)")
        if input().lower().strip() == "y":
            start_viewer_server(config_path)
    except Exception as e:
        print(f"\n生成配置文件时出错: {e}")

    print("\n按回车键继续...")
    input()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="轨道查看器")
    parser.add_argument("-c", "--config", help="指定要加载的JSON配置文件路径")
    parser.add_argument("-s", "--silent", action="store_true", help="静默模式（不显示欢迎信息）")
    parser.add_argument("--quick", action="store_true", help="快速启动（无交互菜单）")
    return parser


def run_non_interactive(config: Optional[str], *, silent: bool) -> int:
    if not silent:
        print_header()

    try:
        if config:
            cfg = _validate_config_path(config)
            logger.info("正在加载配置文件: %s", cfg)
            start_viewer_server(str(cfg))
        else:
            logger.info("以默认模式启动轨道查看器...")
            start_viewer_server()
        return 0
    except KeyboardInterrupt:
        logger.info("程序被中断，正在退出...")
        return 1
    except Exception as e:
        logger.error("启动过程中发生错误: %s", e)
        return 1


def run_interactive() -> int:
    while True:
        try:
            clear_screen()
            print_header()
            print_menu()

            choice = input("请选择操作 (1-5) : ").strip()

            # 允许直接输入 JSON 路径
            if choice.lower().endswith(".json"):
                try:
                    cfg = _validate_config_path(choice)
                    start_viewer_server(str(cfg))
                except Exception as e:
                    print(f"\n错误：{e}")
                    time.sleep(2)
                continue

            if choice == "1":
                clear_screen()
                print_header()
                print("正在启动服务器...\n")
                start_viewer_server()

            elif choice == "2":
                clear_screen()
                print_header()
                print("请输入配置文件的完整路径：")
                print("(输入 'back' 返回主菜单)\n")
                config_path = input("> ").strip()
                if config_path.lower() == "back":
                    continue

                try:
                    cfg = _validate_config_path(config_path)
                    start_viewer_server(str(cfg))
                except Exception as e:
                    print(f"\n错误：{e}")
                    time.sleep(2)

            elif choice == "3":
                generate_config_file_interactive()

            elif choice == "4":
                show_help()

            elif choice == "5":
                clear_screen()
                print_header()
                print("感谢使用！再见！")
                time.sleep(1)
                return 0

            else:
                print("\n无效的选择，请重试...")
                time.sleep(1)

        except KeyboardInterrupt:
            clear_screen()
            print_header()
            print("程序被中断，正在退出...")
            time.sleep(1)
            return 1
        except Exception as e:
            print(f"\n发生错误: {e}")
            print("按回车键继续...")
            input()


def main(argv: Optional[list[str]] = None) -> int:
    setup_logging()

    parser = build_parser()
    args = parser.parse_args(argv)

    # Non-interactive mode is triggered when:
    # - config specified
    # - --quick specified
    # - --silent specified (keeps backward compatibility with the original main.py)
    if args.config or args.quick or args.silent:
        return run_non_interactive(args.config, silent=args.silent)

    return run_interactive()


if __name__ == "__main__":
    raise SystemExit(main())
