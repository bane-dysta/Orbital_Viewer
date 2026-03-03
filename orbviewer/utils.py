from __future__ import annotations

import logging
import os
import socket
from contextlib import closing
from pathlib import Path
from typing import Optional

from urllib.parse import unquote


def setup_logging(level: int = logging.INFO) -> None:
    """Configure logging once.

    Multiple modules used to call logging.basicConfig() independently, which can lead
    to duplicated handlers and inconsistent formats. This helper only configures the
    root logger when it has no handlers.
    """

    root = logging.getLogger()
    if root.handlers:
        root.setLevel(level)
        return

    logging.basicConfig(level=level, format="%(asctime)s - %(levelname)s - %(message)s")


def is_wsl() -> bool:
    """Detect whether we are running under Windows Subsystem for Linux."""

    if os.name != "posix":
        return False
    try:
        return "microsoft" in os.uname().release.lower()
    except Exception:
        return False


def get_local_ip() -> str:
    """Get LAN IP for display.

    This does not require an actual reachable destination; we use a UDP socket
    trick to let the OS choose the outbound interface.
    """

    with closing(socket.socket(socket.AF_INET, socket.SOCK_DGRAM)) as s:
        try:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"


def find_available_port(start_port: int = 8000, max_port: int = 8999, host: str = "0.0.0.0") -> int:
    """Find a free TCP port by attempting to bind."""

    for port in range(start_port, max_port + 1):
        with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue
    raise RuntimeError("未找到可用端口")


def safe_join(base_dir: Path, request_path: str) -> Optional[Path]:
    """Safely map an URL path to a filesystem path under base_dir.

    Returns None if the path would escape base_dir.

    This protects against directory traversal like /../secret.
    """

    # Strip leading slashes. Also normalise Windows-style separators that might
    # appear in config files generated on Windows.
    rel = unquote(request_path.lstrip("/")).replace("\\", "/")
    # Avoid empty path
    if not rel:
        return base_dir

    candidate = (base_dir / rel).resolve()
    try:
        base_resolved = base_dir.resolve()
    except Exception:
        base_resolved = base_dir

    # Ensure candidate is within base directory
    try:
        candidate.relative_to(base_resolved)
    except ValueError:
        return None

    return candidate
