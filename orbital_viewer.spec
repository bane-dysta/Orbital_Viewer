# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('orbital_viewer.html', '.'),  # 包含HTML文件
        ('serve.py', '.'),            # 包含serve.py
        ('config_write.py', '.'),     # 包含config_write.py
        ('main.py', '.')             # 包含main.py
    ],  
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['default.txt'],  # 明确排除default.txt
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# 从打包文件列表中移除任何default.txt
a.datas = [x for x in a.datas if not x[0].endswith('default.txt')]

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Orbital Viewer',  # 建议使用更正式的名称
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # 保持控制台显示以便查看错误信息
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['viewer.ico'],  # 确保图标文件存在并且路径正确
)