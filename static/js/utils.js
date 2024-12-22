// Utils file

// 颜色处理工具
export function getComplementaryColor(hex) {
    // 移除#号
    hex = hex.replace('#', '');
    
    // 转换为RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // 计算互补色
    const rComp = 255 - r;
    const gComp = 255 - g;
    const bComp = 255 - b;
    
    // 转换回十六进制
    return '#' + 
        rComp.toString(16).padStart(2, '0') +
        gComp.toString(16).padStart(2, '0') +
        bComp.toString(16).padStart(2, '0');
}

// 元素符号转换
export function getElementSymbol(atomicNumber) {
    const elements = [
        "H", "He", 
        "Li", "Be", "B", "C", "N", "O", "F", "Ne",
        "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
        "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr",
        "Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe"
    ];
    return elements[atomicNumber - 1] || "X";
}

// 网格布局计算
export function calculateGridDimensions(count) {
    const sqrt = Math.sqrt(count);
    const cols = Math.ceil(sqrt);
    const rows = Math.ceil(count / cols);
    return { rows, cols };
}

// 文件名处理
export function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

// DOM 工具函数
export function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else {
            element.appendChild(child);
        }
    });
    return element;
}

// 防抖函数
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 显示错误信息
export function showError(message) {
    console.error(message);
    alert(message);
}

// 显示Toast提示
export function showToast(message) {
    let toast = document.getElementById('screenshot-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'screenshot-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

// 解析元素符号
export function parseElementSymbol(atomicNumber) {
    const elements = {
        1: 'H', 2: 'He', 3: 'Li', 4: 'Be', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 10: 'Ne',
        11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P', 16: 'S', 17: 'Cl', 18: 'Ar'
    };
    return elements[atomicNumber] || 'X';
}

// 获取共价半径
export function getCovalentRadius(symbol) {
    const radii = {
        'H': 0.31, 'He': 0.28, 'Li': 1.28, 'Be': 0.96, 'B': 0.84, 'C': 0.76, 
        'N': 0.71, 'O': 0.66, 'F': 0.57, 'Ne': 0.58, 'Na': 1.66, 'Mg': 1.41,
        'Al': 1.21, 'Si': 1.11, 'P': 1.07, 'S': 1.05, 'Cl': 1.02, 'Ar': 1.06
    };
    return radii[symbol] || 1.0;
}

// 格式化数字
export function formatNumber(number, decimals = 3) {
    return Number(number).toFixed(decimals);
}

// 检查文件类型
export function checkFileType(filename, extensions) {
    const ext = filename.toLowerCase().split('.').pop();
    return extensions.includes(ext);
}

// 生成唯一ID
export function generateUniqueId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// 深拷贝对象
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// 验证颜色代码
export function isValidColor(color) {
    const s = new Option().style;
    s.color = color;
    return s.color !== '';
}

// 转换RGB到十六进制
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// 转换十六进制到RGB
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// 计算亮度
export function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// 检查颜色对比度
export function getContrastRatio(color1, color2) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

// 获取对比色
export function getContrastColor(hex) {
    const rgb = hexToRgb(hex);
    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
