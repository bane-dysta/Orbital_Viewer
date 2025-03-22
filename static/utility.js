// 定义全局变量、常量和配置对象
const atomColors = {
    'H': '#FFFFFF', 'C': '#808080', 'N': '#0000FF', 'O': '#FF0000',
    'F': '#FFFF00', 'Cl': '#00FF00', 'Br': '#A52A2A', 'I': '#940094',
    'Si': '#D9FFFF', 'Ne': '#B3E3F5', 'Ar': '#80D1E3', 'Kr': '#48D1CC',
    'Xe': '#4194B3', 'S': '#F1E266', 'B': '#FEB5B8'
};

const covalentRadii = {
    'H': 0.31, 'He': 0.28,
    'Li': 1.28, 'Be': 0.96, 'B': 0.84, 'C': 0.76, 'N': 0.71, 'O': 0.66, 'F': 0.57, 'Ne': 0.58,
    'Na': 1.66, 'Mg': 1.41, 'Al': 1.21, 'Si': 1.11, 'P': 1.07, 'S': 1.05, 'Cl': 1.02, 'Ar': 1.06,
    'K': 2.03, 'Ca': 1.76, 'Sc': 1.70, 'Ti': 1.60, 'V': 1.53, 'Cr': 1.39, 'Mn': 1.39, 'Fe': 1.32,
    'Co': 1.26, 'Ni': 1.24, 'Cu': 1.32, 'Zn': 1.22, 'Ga': 1.22, 'Ge': 1.20, 'As': 1.19, 'Se': 1.20,
    'Br': 1.20, 'Kr': 1.16,
    'I': 1.39, 'Xe': 1.40
};

// 修改 generateIsoSurface 函数
function generateIsoSurface(cubeData, isoValue) {
    try {
        const lines = cubeData.split('\n');
        
        // 解析网格数据
        const nx = parseInt(lines[3].trim().split(/\s+/)[0]);
        const ny = parseInt(lines[4].trim().split(/\s+/)[0]);
        const nz = parseInt(lines[5].trim().split(/\s+/)[0]);
        
        // 创建三维数组存体素数据
        const voxels = new Float32Array(nx * ny * nz);
        
        // 跳过头部信息，读取体素数据
        let dataIndex = 0;
        let lineIndex = 6 + parseInt(Math.abs(lines[2].trim().split(/\s+/)[0]));
        
        while (dataIndex < voxels.length && lineIndex < lines.length) {
            const values = lines[lineIndex].trim().split(/\s+/);
            for (let i = 0; i < values.length && dataIndex < voxels.length; i++) {
                if (values[i].trim()) {
                    voxels[dataIndex++] = parseFloat(values[i]);
                }
            }
            lineIndex++;
        }

        // 创建基础几何体
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        geometry.scale(nx, ny, nz);
        
        // 设置顶点位置
        const positions = [];
        const indices = [];
        let vertexIndex = 0;
        
        // 生成网格顶点
        for (let x = 0; x < nx; x++) {
            for (let y = 0; y < ny; y++) {
                for (let z = 0; z < nz; z++) {
                    const value = voxels[x + y * nx + z * nx * ny];
                    if (Math.abs(value) > isoValue) {
                        positions.push(x - nx/2, y - ny/2, z - nz/2);
                        indices.push(vertexIndex++);
                    }
                }
            }
        }
        
        // 更新几何体
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        return geometry;
    } catch (error) {
        console.error('生成等值面失败:', error);
        return null;
    }
}

// 修改网格布局计算函数，优先考虑方形布局
function calculateGridDimensions(count) {
    if (count <= 0) return { rows: 0, cols: 0 };
    
    // 特殊情况处理
    if (count === 1) return { rows: 1, cols: 1 };
    if (count === 2) return { rows: 1, cols: 2 };
    if (count === 3) return { rows: 2, cols: 2 }; // 2*2 布局，一个位置空着
    if (count === 4) return { rows: 2, cols: 2 };
    
    // 对于大于4的数量，计算最接近的方形布局
    const sqrt = Math.sqrt(count);
    const cols = Math.ceil(sqrt);
    const rows = Math.ceil(count / cols);
    
    // 如果行数和列数相差太大，尝试调整为更方正的布局
    if (rows / cols < 0.5) {
        return {
            rows: Math.ceil(Math.sqrt(count)),
            cols: Math.ceil(Math.sqrt(count))
        };
    }
    
    return { rows, cols };
}

// 添加备注解析函数
function parseNotes(notes) {
    if (!notes) return { title: '', pairs: [] };
    
    const lines = notes.trim().split('\n');
    let title = '';
    const pairs = [];
    
    // 处理每一行
    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return;
        
        // 检查是否包含冒号或等号
        if (line.includes(':') || line.includes('=')) {
            const [key, ...valueParts] = line.split(/[:=]/);
            const value = valueParts.join('').trim();
            pairs.push({ key: key.trim(), value });
        } else if (index === 0) {
            // 如果第一行不包含分隔符，将其视为标题
            title = line;
        }
    });
    
    return { title, pairs };
}

// 添加表格绘制函数
function drawNotesTable(ctx, parsedNotes, x, y, maxWidth) {
    const { title, pairs } = parsedNotes;
    if (!title && pairs.length === 0) return 0;

    const scale = 2; // 保持与原有缩放一致
    const padding = 20 * scale;
    const cellPadding = 10 * scale;
    const fontSize = 36 * scale;
    const headerFontSize = 48 * scale;
    const rowHeight = fontSize + cellPadding * 2;
    const headerHeight = headerFontSize + cellPadding * 2;
    
    // 设置字体
    ctx.font = `${fontSize}px Arial`;
    
    // 计算列宽
    let keyColumnWidth = 0;
    let valueColumnWidth = 0;
    pairs.forEach(({ key, value }) => {
        const keyWidth = ctx.measureText(key).width + cellPadding * 2;
        const valueWidth = ctx.measureText(value).width + cellPadding * 2;
        keyColumnWidth = Math.max(keyColumnWidth, keyWidth);
        valueColumnWidth = Math.max(valueColumnWidth, valueWidth);
    });
    
    // 确保表格不超过最大宽度
    const tableWidth = Math.min(maxWidth - padding * 2, keyColumnWidth + valueColumnWidth);
    
    // 绘制标题（如果有）
    let currentY = y + padding;
    if (title) {
        ctx.font = `bold ${headerFontSize}px Arial`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText(title, x + tableWidth / 2, currentY + headerHeight / 2);
        currentY += headerHeight;
        
        // 绘制标题下的分隔线
        ctx.beginPath();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2 * scale;
        ctx.moveTo(x, currentY);
        ctx.lineTo(x + tableWidth, currentY);
        ctx.stroke();
    }
    
    // 绘制数据行
    ctx.font = `${fontSize}px Arial`;
    pairs.forEach(({ key, value }) => {
        // 绘制键
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';
        ctx.fillText(key, x + keyColumnWidth - cellPadding, currentY + rowHeight / 2);
        
        // 绘制值
        ctx.textAlign = 'left';
        ctx.fillText(value, x + keyColumnWidth + cellPadding, currentY + rowHeight / 2);
        
        // 绘制分隔线
        currentY += rowHeight;
        ctx.beginPath();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1 * scale;
        ctx.moveTo(x, currentY);
        ctx.lineTo(x + tableWidth, currentY);
        ctx.stroke();
    });
    
    return currentY - y; // 返回表格总度
}

// 添加全局 switchTab 函数
function switchTab(groupId, tabName) {
    // 获取所有选项卡按钮和内容
    const tabBtns = document.querySelectorAll(`#group-${groupId} .tab-btn`);
    const tabContents = document.querySelectorAll(`#group-${groupId} .tab-content`);
    
    // 移除所有active类
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // 添加active类到选中的选项
    document.querySelector(`#group-${groupId} .tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.querySelector(`#group-${groupId} #${tabName}-tab-${groupId}`).classList.add('active');
}

// 修改 setupControls 方法
function setupControls() {
    ['isoValue', 'minValue', 'maxValue', 'negativeColor', 'positiveColor'].forEach(id => {
        document.getElementById(`${id}-${this.id}`).addEventListener('change', () => this.updateSurfaces());
    });
} 