// 定义全局变量、常量和配置对象
// 存储所有查看器的数据
const viewerGroups = [];

// 查看器组类
const atomColors = {
    'H': '#FFFFFF', 'C': '#808080', 'N': '#0000FF', 'O': '#FF0000',
    'F': '#FFFF00', 'Cl': '#00FF00', 'Br': '#A52A2A', 'I': '#940094',
    'Si': '#D9FFFF', 'Ne': '#B3E3F5', 'Ar': '#80D1E3', 'Kr': '#48D1CC',
    'Xe': '#4194B3', 'S': '#F1E266', 'B': '#FEB5B8'
};

const covalentRadii = {
    'H': 0.31, 'C': 0.76, 'N': 0.71, 'O': 0.66, 'F': 0.57,
    'Cl': 1.02, 'Br': 1.20, 'I': 1.39, 'He': 0.28, 'Ne': 0.58,
    'Ar': 1.06, 'Kr': 1.16, 'Xe': 1.40
};

// 修改 generateIsoSurface 函数
function generateIsoSurface(cubeData, isoValue) {
    try {
        const lines = cubeData.split('\n');
        
        // 解析网格数据
        const nx = parseInt(lines[3].trim().split(/\s+/)[0]);
        const ny = parseInt(lines[4].trim().split(/\s+/)[0]);
        const nz = parseInt(lines[5].trim().split(/\s+/)[0]);
        
        // 创建三维数组存储体素数据
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

// 类定义 - ViewerGroup
class ViewerGroup {
    constructor(id) {
        this.id = id;
        this.viewer = null;
        this.currentData1 = null;
        this.currentData2 = null;

        // 从全局配置获取默认设置
        const defaultSettings = (window.ORBITAL_VIEWER_CONFIG && window.ORBITAL_VIEWER_CONFIG.defaultSettings) || {
            color1: '#0000FF',
            color2: '#FF0000',
            isoValue: '0.002',
            surfaceScale: '1.0',
            showPositive: true
        };

        this.color1 = defaultSettings.color1;
        this.color2 = defaultSettings.color2;
        this.showPositive = defaultSettings.showPositive;
        this.atomList = [];
        this.origin = { x: 0, y: 0, z: 0 };
        this.gridVectors = [];
        this.currentVolumeId1 = null;
        this.currentVolumeId2 = null;
        this.title = `轨道组 ${id}`;
        this.uploadedFiles = [];
        this.fileName1 = '';   // 第一个文件名
        this.fileName2 = '';   // 第二个文件名
        this.basePath = '';
        this.showNegative = true; // 控制是否显示负值
        this.isInitialized = false; // 初始化标志
        this.showCub1 = true;  // 新增：控制 cub1 的显示状态
        this.showCub2 = true;  // 新增：控制 cub2 的显示状态

    }
    async initialize() {
        if (this.isInitialized) return;

        this.viewer = $3Dmol.createViewer(`viewer-${this.id}`, {
            backgroundColor: "white"
        });

        this.setupEventListeners();
        this.setupDropZone();
        this.isInitialized = true;

        // 等待DOM完全加载
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 新增：切换 cub1 显示状态的方法
    toggleCub1() {
        this.showCub1 = !this.showCub1;
        this.updateSurfaces();
        // 更新按钮文本
        $(`#toggleCub1-${this.id}`).text(this.showCub1 ? '隐藏 CUB1' : '显示 CUB1');
    }

    // 新增：切换 cub2 显示状态的方法
    toggleCub2() {
        this.showCub2 = !this.showCub2;
        this.updateSurfaces();
        // 更新按钮文本
        $(`#toggleCub2-${this.id}`).text(this.showCub2 ? '隐藏 CUB2' : '显示 CUB2');
    }

    takeScreenshot() {
        try {
            // 获取查看器的 canvas 元素
            const canvas = document.querySelector(`#viewer-${this.id} canvas`);
            if (!canvas) {
                throw new Error('未找到 canvas 元素');
            }

            // 创建一个临时的 canvas 来处理截图
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(canvas, 0, 0);

            // 将 canvas 转换为 blob
            tempCanvas.toBlob((blob) => {
                // 创建一个新的 ClipboardItem
                const item = new ClipboardItem({ "image/png": blob });

                // 写入剪贴板
                navigator.clipboard.write([item]).then(() => {
                    this.showToast('截图已复制到剪贴板');
                }).catch((err) => {
                    console.error('复制到剪贴板失败:', err);
                    this.showError('复制到剪贴板失败');
                });
            }, 'image/png');

        } catch (error) {
            console.error('截图失败:', error);
            this.showError('截图失败');
        }
    }

    // 添加一个新的 toast 提示方法
    showToast(message) {
        // 检查是否已存在 toast 元素
        let toast = document.getElementById('screenshot-toast');
        if (!toast) {
            // 创建新的 toast 元素
            toast = document.createElement('div');
            toast.id = 'screenshot-toast';
            document.body.appendChild(toast);
        }

        // 设置消息并显示
        toast.textContent = message;
        toast.style.opacity = '1';

        // 3秒后隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    loadConfiguration(config) {
        this.title = config.title;
        this.color1 = config.color1;
        this.color2 = config.color2;
        this.showPositive = config.showPositive;
        this.fileName1 = config.fileName1;
        this.fileName2 = config.fileName2 || '';
        this.showCub1 = true;  // 初始化显示状态
        this.showCub2 = true;  // 初始化显示状态

        $(`#title-${this.id}`).val(config.title);
        $(`#color1-${this.id}`).val(config.color1);
        $(`#color2-${this.id}`).val(config.color2);
        $(`#isoValue-${this.id}`).val(config.isoValue);
        $(`#surfaceScale-${this.id}`).val(config.surfaceScale);
        $(`#scaleDisplay-${this.id}`).text(config.surfaceScale);

        // 更新文件名显示
        $(`#file1-label-${this.id}`).text(`文件 1: ${this.fileName1}`);
        $(`#file2-label-${this.id}`).text(`文件 2: ${this.fileName2 || ''}`);

        // 如果至少有一个文件名，就开始加载
        if (this.fileName1) {
            // 使用 setTimeout 确保在 DOM 更新后再加载文件
            setTimeout(() => this.autoLoadFiles(), 0);
        }
    }


    initialize() {
        this.viewer = $3Dmol.createViewer(`viewer-${this.id}`, {
            backgroundColor: "white"
        });
        this.setupEventListeners();
        this.setupDropZone();
    }

    getConfiguration() {
        return {
            id: this.id,
            title: this.title,
            color1: this.color1,
            color2: this.color2,
            isoValue: $(`#isoValue-${this.id}`).val(),
            surfaceScale: $(`#surfaceScale-${this.id}`).val(),
            showPositive: this.showPositive,
            fileName1: this.fileName1,
            fileName2: this.fileName2
        };
    }



    // 设置文件拖放区域
    setupDropZone() {
        const viewerEl = document.getElementById(`viewer-${this.id}`);
        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';
        dropZone.innerHTML = `
                    <div class="drop-zone-text">拖放 .cube 文件到此处</div>
                    <div class="file-list"></div>
                `;
        viewerEl.appendChild(dropZone);

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            viewerEl.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            viewerEl.addEventListener(eventName, () => {
                dropZone.classList.add('active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            viewerEl.addEventListener(eventName, () => {
                dropZone.classList.remove('active');
            }, false);
        });

        // 修改文件拖放处理
        viewerEl.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files)
                .filter(file => file.name.endsWith('.cube') || file.name.endsWith('.cub'));

            if (files.length > 0) {
                this.handleFiles(files);
            }
        }, false);
    }


    // 简化的文件排序方法
    sortFilesByName(files) {
        return files.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 处理上传的文件
    async handleFiles(newFiles) {
        // 过滤出 .cube/.cub 文件
        const cubeFiles = Array.from(newFiles).filter(file =>
            file.name.endsWith('.cube') || file.name.endsWith('.cub')
        );

        // 如果当前已有两个文件，则清空列表重新开始
        if (this.uploadedFiles.length >= 2) {
            console.log('文件列表已满，清空现有文件并重新加载');
            this.uploadedFiles = [];
        }

        // 添加新文件
        this.uploadedFiles.push(...cubeFiles);

        // 对文件进行排序
        this.uploadedFiles.sort((a, b) => a.name.localeCompare(b.name));

        // 更新文件列表显示
        this.updateFileList();

        try {
            // 处理第一个文件
            if (this.uploadedFiles.length > 0) {
                const firstFile = this.uploadedFiles[0];
                this.fileName1 = firstFile.name;
                this.currentData1 = await this.readFile(firstFile);
                this.atomList = this.parseCubeFile(this.currentData1);

                // 更新界面显示
                const baseName = this.fileName1.replace(/\.[^/.]+$/, "");
                $(`#title-${this.id}`).val(baseName);
                this.title = baseName;
                $(`#file1-label-${this.id}`).text(`文件 1: ${this.fileName1}`);

                // 处理第二个文件（如果存在）
                if (this.uploadedFiles.length >= 2) {
                    const secondFile = this.uploadedFiles[1];
                    this.fileName2 = secondFile.name;
                    this.currentData2 = await this.readFile(secondFile);
                    $(`#file2-label-${this.id}`).text(`文件 2: ${this.fileName2}`);
                } else {
                    // 清除第二个文件的数据
                    this.fileName2 = '';
                    this.currentData2 = null;
                    $(`#file2-label-${this.id}`).text('文件 2:');
                    console.log('等待第二个文件...');
                }

                // 显示分子和轨道
                this.displayMolecule();
                this.updateSurfaces();

                console.log('文件已加载:', this.uploadedFiles.map(f => f.name));
            }
        } catch (error) {
            console.error('文件处理错误:', error);
            this.showError('文件处理失败，请确保文件格式正确');
        }
    }

    // 读取文件内容
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // 更新文件列表显示
    updateFileList() {
        const fileList = document.querySelector(`#viewer-${this.id} .file-list`);
        fileList.innerHTML = this.uploadedFiles
            .map(file => `<div class="file-item">${file.name}</div>`)
            .join('');
    }

    // 设置事件监听
    setupEventListeners() {
        const group = this;

        // 标题更改
        $(`#title-${this.id}`).on('change', function () {
            group.title = this.value;
        });

        // 缩放滑块
        $(`#surfaceScale-${this.id}`).on('input', function () {
            $(`#scaleDisplay-${group.id}`).text(this.value);
            group.updateSurfaces();
        });

        // 密度值输入
        $(`#isoValue-${this.id}`).on('change', function () {
            group.updateSurfaces();
        });

        // 修复第一个错误：增加分号
        $(`#color1-${this.id}`).on('change', function () {
            group.color1 = this.value;
            group.updateSurfaces();
        });

        // 修复第二个错误：格式化和增加分号
        $(`#color2-${this.id}`).on('change', function () {
            group.color2 = this.value;
            group.updateSurfaces();
        });
    }

    // 自动加载文件
    async autoLoadFiles() {
        try {
            console.log('正在加载文件:', {
                fileName1: this.fileName1,
                fileName2: this.fileName2
            });

            // 加载第一个文件
            if (this.fileName1) {
                const response1 = await fetch(this.fileName1);
                if (!response1.ok) {
                    throw new Error(`无法加载文件 ${this.fileName1}: ${response1.status}`);
                }
                this.currentData1 = await response1.text();
                this.atomList = this.parseCubeFile(this.currentData1);

                // 立即显示第一个文件
                this.displayMolecule();
                this.updateSurfaces();
            }

            // 仅当 fileName2 有实际值（非空字符串）时才尝试加载第二个文件
            if (this.fileName2 && this.fileName2.trim() !== '') {
                const response2 = await fetch(this.fileName2);
                if (!response2.ok) {
                    throw new Error(`无法加载文件 ${this.fileName2}: ${response2.status}`);
                }
                this.currentData2 = await response2.text();

                // 更新显示以包含第二个文件
                this.updateSurfaces();
            }

            console.log('文件加载成功');
        } catch (error) {
            console.error('文件加载错误:', error);
            this.showError(error.message);
        }
    }



    // 更新表面
    updateSurfaces() {
        if (!this.viewer) return;

        this.viewer.clear();
        this.displayMolecule();

        const surfaceScale = parseFloat($(`#surfaceScale-${this.id}`).val());
        const isoValue = parseFloat($(`#isoValue-${this.id}`).val());

        // 显示第一个文件
        if (this.currentData1 && this.showCub1) {
            this.currentVolumeId1 = this.viewer.addVolumetricData(this.currentData1, "cube", {
                isoval: isoValue / surfaceScale,
                color: this.color1,
                opacity: 0.85,
                wireframe: false,
                origin: this.origin,
                dimensional: true
            });

            const negativeColor = this.getComplementaryColor(this.color1);
            this.viewer.addVolumetricData(this.currentData1, "cube", {
                isoval: -isoValue / surfaceScale,
                color: negativeColor,
                opacity: 0.85,
                wireframe: false,
                origin: this.origin,
                dimensional: true
            });

        }

        // 如果有第二个文件则显示
        if (this.currentData2 && this.showCub2) {
            this.currentVolumeId2 = this.viewer.addVolumetricData(this.currentData2, "cube", {
                isoval: isoValue / surfaceScale,
                color: this.color2,
                opacity: 0.85,
                wireframe: false,
                origin: this.origin,
                dimensional: true
            });
            const negativeColor = this.getComplementaryColor(this.color2);
            this.viewer.addVolumetricData(this.currentData2, "cube", {
                isoval: -isoValue / surfaceScale,
                color: negativeColor,
                opacity: 0.85,
                wireframe: false,
                origin: this.origin,
                dimensional: true
            });
        }

        this.viewer.render();
    }

    // 获取补色的辅助方法
    getComplementaryColor(hexColor) {
        // 移除#号
        const hex = hexColor.replace('#', '');

        // 转换为RGB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // 计算补色
        const rComplement = 255 - r;
        const gComplement = 255 - g;
        const bComplement = 255 - b;

        // 转回十六进制
        return '#' +
            rComplement.toString(16).padStart(2, '0') +
            gComplement.toString(16).padStart(2, '0') +
            bComplement.toString(16).padStart(2, '0');
    }

    // 显示错误信息
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
                    position: absolute;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #ff5252;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 4px;
                    z-index: 1000;
                `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    // 解析 Cube 文件
    parseCubeFile(data) {
        try {
            const lines = data.split('\n');
            const tempAtomList = [];

            // 解析原子数量
            const natoms = Math.abs(parseInt(lines[2].trim().split(/\s+/)[0]));

            // 解析原点坐标
            const originLine = lines[2].trim().split(/\s+/);
            this.origin = {
                x: parseFloat(originLine[1]),
                y: parseFloat(originLine[2]),
                z: parseFloat(originLine[3])
            };

            // 解析网格向量
            this.gridVectors = [];
            for (let i = 0; i < 3; i++) {
                const gridLine = lines[i + 3].trim().split(/\s+/);
                this.gridVectors.push({
                    nx: parseInt(gridLine[0]),
                    x: parseFloat(gridLine[1]),
                    y: parseFloat(gridLine[2]),
                    z: parseFloat(gridLine[3])
                });
            }

            // 解析原子坐标
            const bohrToAng = 0.529177;
            for (let i = 0; i < natoms; i++) {
                const line = lines[i + 6].trim().split(/\s+/);
                tempAtomList.push({
                    elem: this.getElementSymbol(parseInt(line[0])),
                    x: parseFloat(line[2]) * bohrToAng,
                    y: parseFloat(line[3]) * bohrToAng,
                    z: parseFloat(line[4]) * bohrToAng
                });
            }

            return tempAtomList;
        } catch (error) {
            console.error('解析 Cube 文件失败:', error);
            this.showError('Cube 文件格式错误');
            return [];
        }
    }

    // 获取元素符号
    getElementSymbol(atomicNumber) {
        const elements = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
            "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar"];
        return elements[atomicNumber - 1] || "X";
    }

    // 计算原子间距离
    calculateDistance(atom1, atom2) {
        const dx = atom1.x - atom2.x;
        const dy = atom1.y - atom2.y;
        const dz = atom1.z - atom2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // 获取共价半径
    getCovalentRadius(element) {
        return covalentRadii[element] || 1.0;
    }

    // 显示分子结构
    displayMolecule() {
        if (!this.viewer || this.atomList.length === 0) return;

        // 添加原子
        const ATOM_SIZE = 0.4;
        this.atomList.forEach(atom => {
            const color = atomColors[atom.elem] || '#808080';
            this.viewer.addSphere({
                center: { x: atom.x, y: atom.y, z: atom.z },
                radius: ATOM_SIZE,
                color: color
            });
        });

        // 添加化学键
        for (let i = 0; i < this.atomList.length; i++) {
            for (let j = i + 1; j < this.atomList.length; j++) {
                const atom1 = this.atomList[i];
                const atom2 = this.atomList[j];
                const distance = this.calculateDistance(atom1, atom2);

                const radius1 = this.getCovalentRadius(atom1.elem);
                const radius2 = this.getCovalentRadius(atom2.elem);

                if (distance < (radius1 + radius2) * 1.3) {
                    this.viewer.addCylinder({
                        start: { x: atom1.x, y: atom1.y, z: atom1.z },
                        end: { x: atom2.x, y: atom2.y, z: atom2.z },
                        radius: 0.1,
                        fromCap: true,
                        toCap: true,
                        color: 'lightgray'
                    });
                }
            }
        }

        this.viewer.zoomTo();
        this.viewer.render();
    }

    // 切换正负等值面
    toggleNegative() {
        this.showNegative = !this.showNegative;
        this.updateSurfaces();
    }

    // 创建HTML结构
    createHTML() {
        const defaultSettings = (window.ORBITAL_VIEWER_CONFIG && window.ORBITAL_VIEWER_CONFIG.defaultSettings) || {
            isoValue: '0.002',
            surfaceScale: '2.0'
        };
        return `
                    <div class="viewer-group" id="group-${this.id}">
                        <input type="text" class="title-input" id="title-${this.id}" value="${this.title}">
                        <div class="viewer-container">
                            <div class="viewer-controls">
                                <div class="control-group">
                                    <div class="input-container">
                                        <div>
                                            <label for="isoValue-${this.id}">等值面值:</label>
                                            <input type="number" id="isoValue-${this.id}" value="${defaultSettings.isoValue}" step="0.001">
                                        </div>
                                        <div class="slider-container">
                                            <label>等值面缩放: <span id="scaleDisplay-${this.id}">${defaultSettings.surfaceScale}</span></label>
                                            <input type="range" id="surfaceScale-${this.id}" min="0.5" max="5.0" step="0.1" value="${defaultSettings.surfaceScale}">
                                        </div>
                                    </div>
                                </div>
                                <div class="control-group">
                                    <div class="file-info">
                                        <div class="file-control">
                                            <label class="file-label" id="file1-label-${this.id}">文件 1:</label>
                                            <input type="color" id="color1-${this.id}" value="${this.color1}">
                                        </div>
                                        <div class="file-control">
                                            <label class="file-label" id="file2-label-${this.id}">文件 2:</label>
                                            <input type="color" id="color2-${this.id}" value="${this.color2}">
                                        </div>
                                    </div>
                                </div>
                                <div class="control-group">
                                    <div class="button-row">
                                        <button class="btn" id="toggleCub1-${this.id}" onclick="viewerGroups[${this.id}].toggleCub1()">
                                            隐藏 CUB1
                                        </button>
                                        <button class="btn" id="toggleCub2-${this.id}" onclick="viewerGroups[${this.id}].toggleCub2()">
                                            隐藏 CUB2
                                        </button>
                                    </div>
                                    <button class="btn screenshot-btn" onclick="viewerGroups[${this.id}].takeScreenshot()">
                                        截图
                                    </button>
                                </div>
                            </div>
                            <div class="viewer" id="viewer-${this.id}"></div>
                        </div>
                    </div>
                `;
    }
}

// 将 calculateGridDimensions 函数移到类外部作为全局函数
function calculateGridDimensions(count) {
    // 计算最接近的行列数
    const aspectRatio = 16/9; // 假设理想的宽高比为16:9
    const cols = Math.ceil(Math.sqrt(count * aspectRatio));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
}

// 添加新的查看器组
function addNewViewerGroup() {
    const newId = viewerGroups.length;
    const newGroup = new ViewerGroup(newId);
    viewerGroups.push(newGroup);

    // 添加HTML结构
    const container = document.getElementById('viewers-container');
    container.insertAdjacentHTML('beforeend', newGroup.createHTML());

    // 初始化查看器
    newGroup.initialize();
}

function saveConfiguration() {
    const config = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        globalTitle: document.getElementById('global-title').value, // 添加全局标题
        viewers: viewerGroups.map(group => group.getConfiguration())
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbital-viewer-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

let BASE_PATH = '';



async function captureAllViewers() {
    if (viewerGroups.length === 0) {
        alert('没有可用的轨道组！');
        return;
    }

    try {
        const finalCanvas = document.createElement('canvas');
        const ctx = finalCanvas.getContext('2d');

        // 缩放因子和间距
        const scale = 2;
        const padding = 40 * scale; // 图片之间的间距
        const titleHeight = 60 * scale; // 标题区域高度
        const lineHeight = 2 * scale; // 分割线高度

        // 计算网格布局
        const { rows, cols } = calculateGridDimensions(viewerGroups.length);
        
        // 获取每个viewer的截图和尺寸信息
        const screenshots = [];
        let maxWidth = 0;
        let maxHeight = 0;

        // 获取每个viewer的截图
        for (let group of viewerGroups) {
            const canvas = document.querySelector(`#viewer-${group.id} canvas`);
            if (!canvas) continue;

            // 创建放大的临时画布
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width * scale;
            tempCanvas.height = (canvas.height + titleHeight / scale + lineHeight / scale * 2) * scale;
            const tempCtx = tempCanvas.getContext('2d');

            // 设置背景
            tempCtx.fillStyle = 'white';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            // 绘制上方分割线
            tempCtx.strokeStyle = '#ddd';
            tempCtx.lineWidth = lineHeight;
            tempCtx.beginPath();
            tempCtx.moveTo(0, 0);
            tempCtx.lineTo(tempCanvas.width, 0);
            tempCtx.stroke();

            // 添加标题
            tempCtx.fillStyle = '#333';
            tempCtx.font = `bold ${24 * scale}px Arial`;
            tempCtx.textAlign = 'center';
            tempCtx.textBaseline = 'middle';
            tempCtx.fillText(group.title, tempCanvas.width / 2, titleHeight / 2);

            // 绘制标题下方分割线
            tempCtx.beginPath();
            tempCtx.moveTo(0, titleHeight);
            tempCtx.lineTo(tempCanvas.width, titleHeight);
            tempCtx.stroke();

            // 绘制内容
            tempCtx.save();
            tempCtx.translate(0, titleHeight + lineHeight);
            tempCtx.scale(scale, scale);
            tempCtx.drawImage(canvas, 0, 0);
            tempCtx.restore();

            // 绘制底部分割线
            tempCtx.beginPath();
            tempCtx.moveTo(0, tempCanvas.height - lineHeight);
            tempCtx.lineTo(tempCanvas.width, tempCanvas.height - lineHeight);
            tempCtx.stroke();

            screenshots.push({
                canvas: tempCanvas,
                width: tempCanvas.width,
                height: tempCanvas.height
            });

            maxWidth = Math.max(maxWidth, tempCanvas.width);
            maxHeight = Math.max(maxHeight, tempCanvas.height);
        }

        // 计算最终画布的大小
        const totalWidth = (maxWidth + padding) * cols - padding;
        const totalHeight = (maxHeight + padding) * rows - padding;

        // 设置最终画布的大小
        finalCanvas.width = totalWidth + padding * 2; // 添加外边距
        finalCanvas.height = totalHeight + padding * 2;

        // 填充白色背景
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // 在网格中绘制所有截图
        let index = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (index >= screenshots.length) break;
                
                const screenshot = screenshots[index];
                const x = padding + col * (maxWidth + padding) + (maxWidth - screenshot.width) / 2;
                const y = padding + row * (maxHeight + padding) + (maxHeight - screenshot.height) / 2;
                
                ctx.drawImage(screenshot.canvas, x, y);
                index++;
            }
        }

        // 将最终的canvas转换为blob并复制到剪贴板
        finalCanvas.toBlob(async (blob) => {
            try {
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);

                let toast = document.getElementById('screenshot-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'screenshot-toast';
                    document.body.appendChild(toast);
                }
                toast.textContent = '全局截图已复制到剪贴板';
                toast.style.opacity = '1';
                setTimeout(() => {
                    toast.style.opacity = '0';
                }, 3000);
            } catch (err) {
                console.error('复制到剪贴板失败:', err);
                alert('复制到剪贴板失败，请检查浏览器权限设置');
            }
        }, 'image/png', 1.0);

    } catch (error) {
        console.error('截图失败:', error);
        alert('截图过程中出现错误');
    }
}

// 加载配置
async function loadConfiguration(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const config = JSON.parse(text);

        // 确定基础路径
        const configPath = file.webkitRelativePath || file.name;

        if (config.globalTitle) {
            document.getElementById('global-title').value = config.globalTitle;
            document.title = config.globalTitle; // 更新页面标题
        }

        // 清除现有查看器组
        document.getElementById('viewers-container').innerHTML = '';
        viewerGroups.length = 0;

        // 创建新的查看器组
        for (const viewerConfig of config.viewers) {
            const newGroup = new ViewerGroup(viewerConfig.id);
            newGroup.basePath = BASE_PATH;
            viewerGroups.push(newGroup);

            // 添加HTML结构
            const container = document.getElementById('viewers-container');
            container.insertAdjacentHTML('beforeend', newGroup.createHTML());

            // 先初始化查看器
            newGroup.initialize();

            // 然后加载配置
            newGroup.loadConfiguration(viewerConfig);
        }
    } catch (error) {
        console.error('加载配置文件失败:', error);
        alert('加载配置文件失败: ' + error.message);
    }

    // 清除文件输入
    event.target.value = '';
}

document.getElementById('global-title').addEventListener('input', function () {
    document.title = this.value || 'Orbital Viewer';
});

// 添加 DOMContentLoaded 事件监听器
document.addEventListener('DOMContentLoaded', function () {
    // 检查是否有配置数据
    if (window.ORBITAL_VIEWER_CONFIG && window.ORBITAL_VIEWER_CONFIG.configData) {
        console.log('正在加载配置:', window.ORBITAL_VIEWER_CONFIG);
        const config = window.ORBITAL_VIEWER_CONFIG.configData;

        // 设置全局标题
        if (config.globalTitle) {
            document.getElementById('global-title').value = config.globalTitle;
            document.title = config.globalTitle;
        }

        // 清除现有查看器组
        document.getElementById('viewers-container').innerHTML = '';
        viewerGroups.length = 0;

        // 创建新的查看器组
        for (const viewerConfig of config.viewers) {
            const newGroup = new ViewerGroup(viewerConfig.id);
            viewerGroups.push(newGroup);

            // 添加HTML结构
            const container = document.getElementById('viewers-container');
            container.insertAdjacentHTML('beforeend', newGroup.createHTML());

            // 初始化查看器
            newGroup.initialize();

            // 加载配置
            newGroup.loadConfiguration(viewerConfig);
        }
    } else {
        // 如果没有配置数据，创建默认的查看器组
        console.log('没有检测到配置数据，创建默认查看器组');
        addNewViewerGroup();
    }
});
