from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Sequence

logger = logging.getLogger(__name__)

SUPPORTED_CUBE_EXTS = {".cub", ".cube"}


class OrbitalRule:
    """Base class for grouping rules."""

    def match(self, files: Sequence[str]) -> List[List[str]]:
        """Return list of matched file groups."""

        raise NotImplementedError


class HoleElectronRule(OrbitalRule):
    """Pair hole_N and electron_N cube files."""

    _hole = re.compile(r"hole_(\d+)\.(?:cub|cube)$", re.IGNORECASE)
    _electron = re.compile(r"electron_(\d+)\.(?:cub|cube)$", re.IGNORECASE)

    def match(self, files: Sequence[str]) -> List[List[str]]:
        pairs: Dict[str, Dict[str, Optional[str]]] = {}

        for file in files:
            m = self._hole.search(file)
            if m:
                idx = m.group(1)
                pairs.setdefault(idx, {"hole": None, "electron": None})["hole"] = file
                continue

            m = self._electron.search(file)
            if m:
                idx = m.group(1)
                pairs.setdefault(idx, {"hole": None, "electron": None})["electron"] = file

        out: List[List[str]] = []
        for idx in sorted(pairs.keys(), key=lambda x: int(x) if x.isdigit() else x):
            pair = pairs[idx]
            if pair["hole"] and pair["electron"]:
                out.append([pair["hole"], pair["electron"]])
        return out


def create_viewer_config(files: Sequence[str], group_id: int) -> Dict:
    """Create a single viewer group config."""

    if not files:
        raise ValueError("files cannot be empty")

    return {
        "id": group_id,
        "title": f"轨道组 {group_id}",
        "color1": "#0000FF",
        "color2": "#FF0000",
        "isoValue": "0.002",
        "showPositive": True,
        "fileName1": files[0],
        "fileName2": files[1] if len(files) > 1 else "",
    }


def generate_config(folder_path: str | Path, rules: Optional[List[OrbitalRule]] = None) -> Dict:
    folder = Path(folder_path).expanduser().resolve()

    if rules is None:
        rules = [HoleElectronRule()]

    config: Dict = {
        "version": "1.0",
        "timestamp": datetime.now().isoformat(),
        "viewers": [],
    }

    group_id = 0

    # Deterministic walk
    for root, dirs, files in os.walk(folder):
        dirs.sort()
        files.sort()

        cube_files = [f for f in files if Path(f).suffix.lower() in SUPPORTED_CUBE_EXTS]
        if not cube_files:
            continue

        root_path = Path(root)

        rel_path_files = [
            (root_path / f).relative_to(folder).as_posix()
            for f in cube_files
        ]

        processed: set[str] = set()

        for rule in rules:
            matched_groups = rule.match(rel_path_files)
            # Keep stable order
            matched_groups = sorted(matched_groups, key=lambda g: (g[0] if g else ""))
            for group in matched_groups:
                config["viewers"].append(create_viewer_config(group, group_id))
                processed.update(group)
                group_id += 1

        # Any remaining files become their own group
        for f in rel_path_files:
            if f in processed:
                continue
            config["viewers"].append(create_viewer_config([f], group_id))
            group_id += 1

    return config


def write_config(folder_path: str | Path, output_filename: Optional[str] = None) -> str:
    folder = Path(folder_path).expanduser().resolve()
    if not folder.exists():
        raise FileNotFoundError(f"文件夹不存在: {folder}")

    config = generate_config(folder)

    if not output_filename:
        output_filename = f"orbital-viewer-config-{datetime.now().strftime('%Y-%m-%d')}.json"

    if not output_filename.endswith(".json"):
        output_filename += ".json"

    output_path = folder / output_filename

    output_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")

    logger.info("配置文件已生成: %s", output_path)
    return str(output_path)
