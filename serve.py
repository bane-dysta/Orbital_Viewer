"""Backward-compatible server entrypoint.

The server implementation has been moved to :mod:`orbviewer.server`.
This module keeps the public API `start_viewer_server` stable for existing imports.
"""

import logging

from orbviewer.server import start_viewer_server
from orbviewer.utils import setup_logging


if __name__ == "__main__":
    setup_logging(logging.INFO)
    start_viewer_server()
