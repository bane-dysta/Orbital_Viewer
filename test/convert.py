#!/usr/bin/env python3
"""
Convert 3Dmol.js view parameters to VMD format
3Dmol.js format: [pos.x, pos.y, pos.z, zoom, quat.x, quat.y, quat.z, quat.w]
VMD format: {center_matrix rotate_matrix scale_matrix}
"""

import json
import numpy as np
import sys

def quaternion_to_rotation_matrix(qx, qy, qz, qw):
    """
    Convert quaternion to 3x3 rotation matrix
    Quaternion format: (x, y, z, w)
    """
    # Normalize quaternion
    norm = np.sqrt(qx*qx + qy*qy + qz*qz + qw*qw)
    qx, qy, qz, qw = qx/norm, qy/norm, qz/norm, qw/norm
    
    # Convert to rotation matrix
    R = np.array([
        [1 - 2*(qy*qy + qz*qz),     2*(qx*qy - qw*qz),     2*(qx*qz + qw*qy)],
        [    2*(qx*qy + qw*qz), 1 - 2*(qx*qx + qz*qz),     2*(qy*qz - qw*qx)],
        [    2*(qx*qz - qw*qy),     2*(qy*qz + qw*qx), 1 - 2*(qx*qx + qy*qy)]
    ])
    
    return R

def create_4x4_matrix(mat3x3, translation=None):
    """
    Convert 3x3 matrix to 4x4 homogeneous matrix
    """
    mat4x4 = np.eye(4)
    mat4x4[:3, :3] = mat3x3
    if translation is not None:
        mat4x4[:3, 3] = translation
    return mat4x4

def format_vmd_matrix(matrix):
    """
    Format matrix in VMD style: {{row1} {row2} {row3} {row4}}
    """
    rows = []
    for i in range(4):
        row_str = " ".join([f"{matrix[i,j]:.6g}" for j in range(4)])
        rows.append("{" + row_str + "}")
    return "{" + " ".join(rows) + "}"

def convert_3dmol_to_vmd(view_array):
    """
    Convert 3Dmol.js view array to VMD format
    
    Parameters:
    view_array: [pos.x, pos.y, pos.z, zoom, quat.x, quat.y, quat.z, quat.w]
    
    Returns:
    VMD format string: {center_matrix rotate_matrix scale_matrix}
    """
    pos_x, pos_y, pos_z, zoom, qx, qy, qz, qw = view_array
    
    # 1. Center matrix (translation)
    # In VMD, center_matrix typically handles the centering of the molecule
    # For 3Dmol.js translation, we'll use negative values
    center_matrix = np.eye(4)
    center_matrix[:3, 3] = [-pos_x, -pos_y, -pos_z]
    
    # 2. Rotation matrix
    # Convert quaternion to rotation matrix
    R = quaternion_to_rotation_matrix(qx, qy, qz, qw)
    rotate_matrix = create_4x4_matrix(R)
    
    # 3. Scale matrix
    # In VMD, scale is typically uniform
    # The zoom parameter in 3Dmol.js relates to camera distance
    # VMD scale is typically around 0.3 for default view
    # We'll use a heuristic: scale = zoom / 100 * 0.3
    scale = zoom / 100.0 * 0.3
    scale_matrix = np.eye(4)
    scale_matrix[0, 0] = scale
    scale_matrix[1, 1] = scale
    scale_matrix[2, 2] = scale
    
    # Format as VMD string
    center_str = format_vmd_matrix(center_matrix)
    rotate_str = format_vmd_matrix(rotate_matrix)
    scale_str = format_vmd_matrix(scale_matrix)
    
    vmd_string = f"{center_str} {rotate_str} {scale_str}"
    
    return vmd_string, center_matrix, rotate_matrix, scale_matrix

def main():
    # Read the JSON file
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
    else:
        json_file = "viewer-0-view-2025-11-17T13-58-16-014Z.json"
    
    print(f"Reading 3Dmol.js view parameters from: {json_file}\n")
    
    with open(json_file, 'r') as f:
        view_array = json.load(f)
    
    print("3Dmol.js view parameters:")
    print(f"  Translation: [{view_array[0]:.6f}, {view_array[1]:.6f}, {view_array[2]:.6f}]")
    print(f"  Zoom: {view_array[3]:.6f}")
    print(f"  Quaternion: [{view_array[4]:.6f}, {view_array[5]:.6f}, {view_array[6]:.6f}, {view_array[7]:.6f}]")
    print()
    
    # Convert to VMD format
    vmd_string, center_mat, rotate_mat, scale_mat = convert_3dmol_to_vmd(view_array)
    
    print("=" * 80)
    print("VMD Format (copy this for use with molinfo top set):")
    print("=" * 80)
    print(vmd_string)
    print()
    
    print("=" * 80)
    print("Detailed matrices:")
    print("=" * 80)
    print("\nCenter Matrix:")
    print(center_mat)
    print("\nRotate Matrix:")
    print(rotate_mat)
    print("\nScale Matrix:")
    print(scale_mat)
    print()
    
    print("=" * 80)
    print("VMD命令使用方法:")
    print("=" * 80)
    print("1. 在VMD的Tk Console中执行:")
    print(f"   molinfo top set {{center_matrix rotate_matrix scale_matrix}} {{{vmd_string}}}")
    print()
    print("2. 或者分别查看各个矩阵:")
    print("   molinfo top get center_matrix")
    print("   molinfo top get rotate_matrix")
    print("   molinfo top get scale_matrix")

if __name__ == "__main__":
    main()