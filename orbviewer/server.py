from __future__ import annotations

import json
import logging
import mimetypes
import os
import subprocess
import urllib.parse
import webbrowser
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from socketserver import ThreadingMixIn
from typing import Any, Dict, Optional, Tuple

import socket
import socketserver

from .convert import convert_3dmol_view_to_vmd
from .resources import default_settings_search_paths, resolve_resource, static_dir
from .settings import load_default_settings
from .utils import find_available_port, get_local_ip, is_wsl, safe_join

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ServerContext:
    # Files (cub/json/etc) are served from here.
    serve_dir: Path

    # Where static assets live (html/js/css). This should point at the bundled static/ directory.
    static_dir: Path

    # The HTML template content.
    html_template: str

    # Default settings injected into the page.
    default_settings: Dict[str, Any]

    # Optional pre-loaded config data.
    config_data: Optional[Dict[str, Any]] = None

    # Optional config filename (for display / query compatibility).
    config_name: Optional[str] = None


class ThreadedHTTPServer(ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def _render_index_html(template: str, default_settings: Dict[str, Any], config_data: Optional[Dict[str, Any]] = None,
                       config_path: Optional[str] = None) -> bytes:
    """Inject window.ORBITAL_VIEWER_CONFIG into the HTML template."""

    payload: Dict[str, Any] = {
        "defaultSettings": default_settings,
    }
    if config_data is not None:
        payload["configData"] = config_data
    if config_path is not None:
        payload["configPath"] = config_path

    init_script = "<script>\n" + "window.ORBITAL_VIEWER_CONFIG = " + json.dumps(payload) + ";\n" + "</script>\n"

    # Insert before </head> if possible
    lower = template.lower()
    idx = lower.find("</head>")
    if idx != -1:
        rendered = template[:idx] + init_script + template[idx:]
    else:
        rendered = init_script + template

    return rendered.encode("utf-8")


def _guess_mime(path: Path) -> str:
    # Ensure common web types even if the platform mimetypes is incomplete.
    ext = path.suffix.lower()
    hardcoded = {
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }
    if ext in hardcoded:
        return hardcoded[ext]

    mime, _ = mimetypes.guess_type(str(path))
    return mime or "application/octet-stream"


def _read_json_file(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def make_handler(context: ServerContext):
    """Factory to create a request handler bound to a given ServerContext."""

    class OrbitalViewerHandler(BaseHTTPRequestHandler):
        server_version = "OrbitalViewerHTTP/1.0"

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            # Delegate to logging
            logger.info("%s - %s", self.address_string(), format % args)

        def _send_bytes(self, data: bytes, content_type: str, status: int = 200, *, cache_control: str = "no-store") -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", cache_control)
            # Basic hardening
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)

        def _send_json(self, obj: Any, status: int = 200) -> None:
            data = json.dumps(obj).encode("utf-8")
            self._send_bytes(data, "application/json", status=status, cache_control="no-store")

        def _send_file(self, path: Path, *, cache_control: str = "no-store") -> None:
            # Stream file to client
            try:
                if not path.exists() or not path.is_file():
                    self.send_error(HTTPStatus.NOT_FOUND, "File not found")
                    return

                content_type = _guess_mime(path)
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(path.stat().st_size))
                self.send_header("Cache-Control", cache_control)
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()

                import shutil
                with path.open("rb") as f:
                    shutil.copyfileobj(f, self.wfile, length=64 * 1024)
            except Exception as e:
                logger.exception("发送文件失败: %s", e)
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Failed to send file")

        def do_GET(self) -> None:  # noqa: N802
            try:
                parsed = urllib.parse.urlsplit(self.path)
                path = parsed.path
                query = urllib.parse.parse_qs(parsed.query)

                # Index page
                if path == "/":
                    cfg_data = context.config_data
                    cfg_path_str: Optional[str] = None

                    # Backward compatible: allow /?config=xxx.json to load config from serve_dir.
                    if cfg_data is None and "config" in query and query["config"]:
                        requested = query["config"][0]

                        # Only allow files under serve_dir
                        cfg_path = safe_join(context.serve_dir, requested)
                        if cfg_path is None:
                            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid config path")
                            return
                        if not cfg_path.exists():
                            self.send_error(HTTPStatus.NOT_FOUND, "Config not found")
                            return
                        try:
                            cfg_data = _read_json_file(cfg_path)
                            cfg_path_str = str(cfg_path)
                        except Exception as e:
                            logger.error("读取配置文件失败 %s: %s", cfg_path, e)
                            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Failed to read config")
                            return
                    elif context.config_name is not None:
                        cfg_path_str = context.config_name

                    html = _render_index_html(
                        context.html_template,
                        default_settings=context.default_settings,
                        config_data=cfg_data,
                        config_path=cfg_path_str,
                    )
                    self._send_bytes(html, "text/html; charset=utf-8")
                    return

                # Static assets
                if path.startswith("/static/"):
                    rel = path[len("/static/") :]
                    asset_path = safe_join(context.static_dir, rel)
                    if asset_path is None:
                        self.send_error(HTTPStatus.BAD_REQUEST, "Invalid path")
                        return
                    self._send_file(asset_path, cache_control="public, max-age=3600")
                    return

                # User files (.cub/.cube/.json etc) served from serve_dir
                fs_path = safe_join(context.serve_dir, path)
                if fs_path is None:
                    self.send_error(HTTPStatus.BAD_REQUEST, "Invalid path")
                    return
                if fs_path.exists() and fs_path.is_file():
                    self._send_file(fs_path)
                    return

                self.send_error(HTTPStatus.NOT_FOUND, "Not found")

            except Exception as e:
                logger.exception("处理GET请求时出错: %s", e)
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Internal error")

        def do_POST(self) -> None:  # noqa: N802
            try:
                parsed = urllib.parse.urlsplit(self.path)
                path = parsed.path

                if path != "/convert-view":
                    self.send_error(HTTPStatus.NOT_FOUND, "Not found")
                    return

                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length)

                try:
                    payload = json.loads(raw.decode("utf-8"))
                except Exception:
                    self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
                    return

                try:
                    # 3Dmol getView returns an array-like of 8 floats
                    if not isinstance(payload, list):
                        raise ValueError("Expected JSON array")
                    vmd_string = convert_3dmol_view_to_vmd(payload)
                except Exception as e:
                    logger.error("视角转换失败: %s", e)
                    self.send_error(HTTPStatus.BAD_REQUEST, f"Conversion failed: {e}")
                    return

                self._send_json({"vmd_string": vmd_string})

            except Exception as e:
                logger.exception("处理POST请求时出错: %s", e)
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Internal error")

    return OrbitalViewerHandler


def _open_in_browser(url: str, *, wsl: bool) -> None:
    """Open URL in a browser.

    - Normal env: webbrowser.open
    - WSL: powershell Start-Process
    """

    if wsl:
        try:
            # Use Windows default browser from WSL.
            # Avoid shell=True; pass args as a list.
            subprocess.Popen(["powershell.exe", "-Command", f"Start-Process '{url}'"], stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
        except Exception as e:
            logger.warning("WSL环境下无法自动打开浏览器: %s", e)
            logger.info("请手动访问: %s", url)
        return

    try:
        webbrowser.open(url)
    except Exception as e:
        logger.warning("无法自动打开浏览器: %s", e)
        logger.info("请手动访问: %s", url)


def start_viewer_server(config_path: Optional[str] = None) -> None:
    """Start the local Orbital Viewer HTTP server.

    Args:
        config_path: optional JSON config to preload.

    Behaviour remains compatible with the original serve.py:
    - Static files come from the bundled static/ directory.
    - When a config is provided, files (cub/json) are served from the config directory.
    """

    # Determine directories
    serve_dir = Path(os.getcwd()).resolve()
    config_data: Optional[Dict[str, Any]] = None
    config_name: Optional[str] = None

    if config_path:
        cfg = Path(config_path).expanduser().resolve()
        if not cfg.exists():
            raise FileNotFoundError(f"配置文件不存在: {cfg}")
        if cfg.suffix.lower() != ".json":
            raise ValueError("配置文件必须是 .json")
        serve_dir = cfg.parent
        config_name = cfg.name
        config_data = _read_json_file(cfg)

    # Load default settings (default.txt)
    defaults = load_default_settings(default_settings_search_paths(serve_dir))

    # Load HTML template
    html_path = resolve_resource("orbital_viewer.html")
    if not html_path.exists():
        raise FileNotFoundError(f"HTML文件不存在: {html_path}")
    html_template = html_path.read_text(encoding="utf-8")

    context = ServerContext(
        serve_dir=serve_dir,
        static_dir=static_dir(),
        html_template=html_template,
        default_settings=defaults,
        config_data=config_data,
        config_name=config_name,
    )

    # Bind server
    port = find_available_port()
    host = "0.0.0.0"

    local_ip = get_local_ip()

    handler_cls = make_handler(context)
    with ThreadedHTTPServer((host, port), handler_cls) as httpd:
        logger.info("找到可用端口: %s", port)
        logger.info("本地访问地址: http://localhost:%s", port)
        logger.info("局域网访问地址: http://%s:%s", local_ip, port)

        # Construct URL (keep query param for backward compatibility)
        if config_name:
            url = f"http://localhost:{port}/?" + urllib.parse.urlencode({"config": config_name})
        else:
            url = f"http://localhost:{port}/"

        logger.info("正在浏览器中打开: %s", url)
        _open_in_browser(url, wsl=is_wsl())

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("服务器已停止")
