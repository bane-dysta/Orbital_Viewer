from __future__ import annotations

import math
from typing import Iterable, List, Sequence


def _format_g0_6(x: float) -> str:
    """Mimic Fortran G0.6 formatting reasonably.

    For our purpose (copying into VMD), Python's .6g is close enough.
    """

    # Normalize -0.0 to 0 to avoid confusing output
    if x == 0:
        x = 0.0
    return format(x, ".6g")


def _identity4() -> List[List[float]]:
    return [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def quaternion_to_rotation_matrix(qx: float, qy: float, qz: float, qw: float) -> List[List[float]]:
    """Convert quaternion (x, y, z, w) to a 3x3 rotation matrix."""

    norm = math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw)
    if norm == 0:
        raise ValueError("Quaternion norm is zero")

    qx /= norm
    qy /= norm
    qz /= norm
    qw /= norm

    return [
        [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qw * qz), 2 * (qx * qz + qw * qy)],
        [2 * (qx * qy + qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qw * qx)],
        [2 * (qx * qz - qw * qy), 2 * (qy * qz + qw * qx), 1 - 2 * (qx * qx + qy * qy)],
    ]


def _format_vmd_matrix(mat4: Sequence[Sequence[float]]) -> str:
    rows = []
    for i in range(4):
        row = " ".join(_format_g0_6(float(mat4[i][j])) for j in range(4))
        rows.append("{" + row + "}")
    return "{" + " ".join(rows) + "}"


def convert_3dmol_view_to_vmd(view: Sequence[float]) -> str:
    """Convert a 3Dmol.js view array to VMD format.

    Input format (3Dmol.js getView):
        [pos.x, pos.y, pos.z, zoom, quat.x, quat.y, quat.z, quat.w]

    Output format (single string):
        {center_matrix} {rotate_matrix} {scale_matrix}
    """

    if len(view) != 8:
        raise ValueError(f"Expected 8 numbers, got {len(view)}")

    pos_x, pos_y, pos_z, zoom, qx, qy, qz, qw = [float(x) for x in view]

    # Center matrix
    center = _identity4()
    center[0][3] = -pos_x
    center[1][3] = -pos_y
    center[2][3] = -pos_z

    # Rotation matrix
    R = quaternion_to_rotation_matrix(qx, qy, qz, qw)
    rotate = _identity4()
    for i in range(3):
        for j in range(3):
            rotate[i][j] = R[i][j]

    # Scale matrix
    scale_val = zoom / 100.0 * 0.3
    scale = _identity4()
    scale[0][0] = scale_val
    scale[1][1] = scale_val
    scale[2][2] = scale_val

    return f"{_format_vmd_matrix(center)} {_format_vmd_matrix(rotate)} {_format_vmd_matrix(scale)}"
