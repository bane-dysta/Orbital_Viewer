"""Backward-compatible quick start entrypoint.

The original quick_start.py always started the server without the interactive menu.
We keep that behaviour by forwarding to orbviewer.cli with the --quick flag.
"""

import sys

from orbviewer.cli import main


if __name__ == "__main__":
    # Force non-interactive behaviour while preserving existing flags.
    raise SystemExit(main(["--quick", *sys.argv[1:]]))
