from __future__ import annotations

import os
import sys
from pathlib import Path


def project_root() -> Path:
    """Return the base directory where bundled resources live.

    - In development: repository root (parent of this package directory).
    - In PyInstaller build: sys._MEIPASS.

    The old code used get_resource_path() in multiple places; this function centralises
    that logic.
    """

    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent


def static_dir() -> Path:
    return project_root() / "static"


def resolve_resource(relative_path: str) -> Path:
    """Resolve a resource path.

    For convenience (and backward compatibility), callers may pass either:
    - "orbital_viewer.html"  (searched under static/ first)
    - "static/orbital_viewer.html" (also works)

    If the resource does not exist, this still returns the *expected* static path,
    so the caller can handle the error consistently.
    """

    rel = relative_path
    if rel.startswith("static/"):
        rel = rel[len("static/") :]

    root = project_root()

    cand_static = root / "static" / rel
    if cand_static.exists():
        return cand_static

    cand_root = root / rel
    if cand_root.exists():
        return cand_root

    return cand_static


def default_settings_search_paths(config_dir: Path | None = None) -> list[Path]:
    """Where to look for default.txt.

    Historically, default.txt was expected to live in the current working directory
    or beside the script. We add the config directory (when known) as well.
    """

    paths: list[Path] = []
    if config_dir is not None:
        paths.append(config_dir / "default.txt")

    # CWD
    try:
        paths.append(Path(os.getcwd()) / "default.txt")
    except Exception:
        pass

    # Project root
    paths.append(project_root() / "default.txt")

    return paths
