"""Orbital Viewer - Python side utilities (CLI, config generation, local HTTP server).

This package is intentionally lightweight: it keeps backwards-compatible entrypoints
(main.py / quick_start.py / serve.py) working while moving the actual logic into
modules with clearer separation of concerns.
"""

from .server import start_viewer_server  # re-export for convenience
from .config_gen import write_config  # re-export for convenience

__all__ = ["start_viewer_server", "write_config"]
