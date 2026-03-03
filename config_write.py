"""Backward-compatible config generator.

The implementation lives in :mod:`orbviewer.config_gen`.
This wrapper keeps the old import path working (config_write.write_config).
"""

from orbviewer.config_gen import (  # noqa: F401
    HoleElectronRule,
    OrbitalRule,
    create_viewer_config,
    generate_config,
    write_config,
)


def main() -> None:
    import sys

    if len(sys.argv) > 1:
        folder_path = sys.argv[1]
        try:
            config_path = write_config(folder_path)
            print(f"配置文件已生成: {config_path}")
        except Exception as e:
            print(f"错误: {e}")
    else:
        print("请提供文件夹路径")


if __name__ == "__main__":
    main()
