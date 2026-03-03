from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)


DEFAULT_SETTINGS: Dict[str, Any] = {
    "color1": "#0000FF",
    "color2": "#FF0000",
    "isoValue": "0.002",
    "surfaceScale": "1.0",
    "showPositive": True,
}


def parse_default_file(file_content: str) -> Dict[str, Any]:
    """Parse a simple key=value file (default.txt)."""

    settings: Dict[str, Any] = {}

    for raw_line in file_content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if "=" not in line:
            continue

        key, value = [x.strip() for x in line.split("=", 1)]

        # Bool
        if value.lower() == "true":
            settings[key] = True
            continue
        if value.lower() == "false":
            settings[key] = False
            continue

        settings[key] = value

    return settings


def _is_valid_hex_color(value: str) -> bool:
    return isinstance(value, str) and value.startswith("#") and len(value) == 7


def validate_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and coerce settings.

    - isoValue/surfaceScale must be numeric (kept as string, consistent with existing JSON).
    - color1/color2 must be #RRGGBB.
    """

    out: Dict[str, Any] = dict(settings)

    for key in ("isoValue", "surfaceScale"):
        if key in out:
            try:
                float(out[key])
            except Exception:
                logger.warning("无效的数值 %s=%r，将忽略", key, out[key])
                out.pop(key, None)

    for key in ("color1", "color2"):
        if key in out and not _is_valid_hex_color(str(out[key])):
            logger.warning("无效的颜色格式 %s=%r，将忽略", key, out[key])
            out.pop(key, None)

    return out


def load_default_settings(search_paths: list[Path]) -> Dict[str, Any]:
    """Load default settings from the first existing path in search_paths."""

    settings = dict(DEFAULT_SETTINGS)

    for path in search_paths:
        try:
            if path.exists() and path.is_file():
                content = path.read_text(encoding="utf-8")
                custom = validate_settings(parse_default_file(content))
                settings.update(custom)
                logger.info("已加载自定义默认设置: %s (from %s)", custom, path)
                break
        except Exception as e:
            logger.warning("加载默认设置失败 (%s): %s", path, e)

    return settings
