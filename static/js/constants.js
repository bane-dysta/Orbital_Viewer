// Constants file

// 原子颜色
export const ATOM_COLORS = {
    'H': '#FFFFFF',  // 白色
    'He': '#D9FFFF', // 浅青色
    'Li': '#CC80FF', // 紫色
    'Be': '#C2FF00', // 黄绿色
    'B': '#FFB5B5',  // 浅红色
    'C': '#909090',  // 灰色
    'N': '#3050F8',  // 蓝色
    'O': '#FF0D0D',  // 红色
    'F': '#90E050',  // 绿色
    'Ne': '#B3E3F5', // 青色
    'Na': '#AB5CF2', // 紫色
    'Mg': '#8AFF00', // 黄绿色
    'Al': '#BFA6A6', // 浅棕色
    'Si': '#F0C8A0', // 棕色
    'P': '#FF8000',  // 橙色
    'S': '#FFFF30',  // 黄色
    'Cl': '#1FF01F', // 绿色
    'Ar': '#80D1E3'  // 浅蓝色
};

// 共价半径（单位：埃米）
export const COVALENT_RADII = {
    'H': 0.31,
    'He': 0.28,
    'Li': 1.28,
    'Be': 0.96,
    'B': 0.84,
    'C': 0.76,
    'N': 0.71,
    'O': 0.66,
    'F': 0.57,
    'Ne': 0.58,
    'Na': 1.66,
    'Mg': 1.41,
    'Al': 1.21,
    'Si': 1.11,
    'P': 1.07,
    'S': 1.05,
    'Cl': 1.02,
    'Ar': 1.06
};

// 默认设置
export const DEFAULT_SETTINGS = {
    color1: '#0000FF',      // 默认第一个颜色（蓝色）
    color2: '#FF0000',      // 默认第二个颜色（红色）
    isoValue: '0.002',      // 默认等值面值
    surfaceScale: '1.0',    // 默认表面缩放
    showPositive: true,     // 默认显示正值
    minMapValue: '-0.02',   // 默认最小映射值
    maxMapValue: '0.03'     // 默认最大映射值
};

// 渲染常量
export const RENDER_CONSTANTS = {
    backgroundColor: 'white',    // 背景颜色
    dragScale: 0.5,             // 拖动灵敏度
    scrollScale: 0.5,           // 滚轮缩放灵敏度
    rotateSpeed: 0.5,           // 旋转速度
    stickRadius: 0.1,           // 棍状模型半径
    sphereRadius: 0.4,          // 球状模型半径
    surfaceOpacity: 0.85,       // 表面透明度
    bondTolerance: 1.3          // 化学键容差
};

// 文件相关常量
export const FILE_CONSTANTS = {
    supportedExtensions: ['.cube', '.cub'],  // 支持的文件扩展名
    maxFileSize: 100 * 1024 * 1024,         // 最大文件大小（100MB）
    bohrToAngstrom: 0.529177249,            // 玻尔半径到埃米的转换因子
    defaultEncoding: 'utf-8'                 // 默认文件编码
};

// UI常量
export const UI_CONSTANTS = {
    toastDuration: 3000,        // Toast提示显示时间（毫秒）
    dragDelay: 200,             // 拖拽延迟（毫秒）
    animationDuration: 300,     // 动画持续时间（毫秒）
    maxViewerGroups: 12,        // 最大查看器组数量
    minViewerHeight: 400,       // 最小查看器高度（像素）
    defaultPadding: 15,         // 默认内边距（像素）
    borderRadius: 4             // 默认边框圆角（像素）
};
