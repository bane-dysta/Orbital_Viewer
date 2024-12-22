import { parseElementSymbol } from './utils.js';

// 解析Cube文件
export function parseCubeFile(content) {
    const lines = content.split('\n');
    let currentLine = 2; // 跳过前两行注释

    // 读取原子数和原点坐标
    const [atomCount, x, y, z] = lines[currentLine].trim().split(/\s+/).map(Number);
    currentLine++;

    // 跳过网格向量信息
    currentLine += 3;

    // 读取原子信息
    const atoms = [];
    for (let i = 0; i < atomCount; i++) {
        const [atomicNumber, charge, x, y, z] = lines[currentLine].trim().split(/\s+/).map(Number);
        atoms.push({
            index: i + 1,
            symbol: parseElementSymbol(atomicNumber),
            atomicNumber,
            charge,
            x, y, z
        });
        currentLine++;
    }

    return atoms;
}

// 检查文件类型
export function checkCubeFile(file) {
    return file.name.toLowerCase().endsWith('.cube') || file.name.toLowerCase().endsWith('.cub');
}

// 读取文件内容
export function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// 生成等值面数据
export function generateIsosurface(data, isoValue) {
    // 这里应该实现等值面生成算法
    // 由于实际实现比较复杂，这里只返回一个示例数据
    return {
        vertices: [],
        faces: [],
        isoValue
    };
}

// 验证文件格式
export function validateCubeFormat(content) {
    try {
        const lines = content.split('\n');
        if (lines.length < 6) {
            throw new Error('文件格式不正确：行数不足');
        }

        // 检查原子数和原点坐标行
        const [atomCount] = lines[2].trim().split(/\s+/).map(Number);
        if (isNaN(atomCount)) {
            throw new Error('文件格式不正确：无法解析原子数');
        }

        // 检查是否有足够的行来包含所有原子信息
        if (lines.length < 6 + atomCount) {
            throw new Error('文件格式不正确：原子信息不完整');
        }

        return true;
    } catch (error) {
        console.error('文件验证失败:', error);
        return false;
    }
}

// 提取文件元数据
export function extractMetadata(content) {
    const lines = content.split('\n');
    return {
        title: lines[0].trim(),
        comment: lines[1].trim(),
        atomCount: parseInt(lines[2].trim().split(/\s+/)[0])
    };
}

// 计算分子边界框
export function calculateBoundingBox(atoms) {
    if (!atoms || atoms.length === 0) return null;

    const bbox = {
        min: { x: Infinity, y: Infinity, z: Infinity },
        max: { x: -Infinity, y: -Infinity, z: -Infinity }
    };

    atoms.forEach(atom => {
        bbox.min.x = Math.min(bbox.min.x, atom.x);
        bbox.min.y = Math.min(bbox.min.y, atom.y);
        bbox.min.z = Math.min(bbox.min.z, atom.z);
        bbox.max.x = Math.max(bbox.max.x, atom.x);
        bbox.max.y = Math.max(bbox.max.y, atom.y);
        bbox.max.z = Math.max(bbox.max.z, atom.z);
    });

    return bbox;
}

// 计算分子中心
export function calculateCenter(atoms) {
    if (!atoms || atoms.length === 0) return null;

    const sum = atoms.reduce((acc, atom) => ({
        x: acc.x + atom.x,
        y: acc.y + atom.y,
        z: acc.z + atom.z
    }), { x: 0, y: 0, z: 0 });

    return {
        x: sum.x / atoms.length,
        y: sum.y / atoms.length,
        z: sum.z / atoms.length
    };
}

// 计算两个原子之间的距离
export function calculateDistance(atom1, atom2) {
    const dx = atom1.x - atom2.x;
    const dy = atom1.y - atom2.y;
    const dz = atom1.z - atom2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 检查是否存在化学键
export function checkBond(atom1, atom2, tolerance = 1.3) {
    const distance = calculateDistance(atom1, atom2);
    const maxBondLength = (getCovalentRadius(atom1.symbol) + getCovalentRadius(atom2.symbol)) * tolerance;
    return distance <= maxBondLength;
}

// 生成化学键列表
export function generateBonds(atoms, tolerance = 1.3) {
    const bonds = [];
    for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
            if (checkBond(atoms[i], atoms[j], tolerance)) {
                bonds.push([i, j]);
            }
        }
    }
    return bonds;
}
