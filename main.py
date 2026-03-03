"""Backward-compatible entrypoint.

Historically main.py contained the interactive menu + CLI parsing.
It has been refactored into orbviewer.cli for clearer separation of concerns.
"""

from orbviewer.cli import main


if __name__ == "__main__":
    raise SystemExit(main())
