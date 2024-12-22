// NotesManager 类 - 处理轨道组备注功能
class NotesManager {
    constructor(groupId) {
        this.groupId = groupId;
        this.notes = '';
        // 延迟设置事件监听器，等待 DOM 加载完成
        setTimeout(() => this.setupEventListeners(), 0);
    }

    // 初始化备注区域
    initialize() {
        const notesArea = document.getElementById(`notes-${this.groupId}`);
        if (notesArea) {
            notesArea.value = this.notes;
            this.setupEventListeners();
        }
    }

    // 设置备注内容
    setNotes(notes) {
        this.notes = notes || '';
        const notesArea = document.getElementById(`notes-${this.groupId}`);
        if (notesArea) {
            notesArea.value = this.notes;
            // 触发 input 事件以调整高度
            const event = new Event('input', {
                bubbles: true,
                cancelable: true,
            });
            notesArea.dispatchEvent(event);
        }
    }

    // 获取备注内容
    getNotes() {
        return this.notes;
    }

    // 设置事件监听器
    setupEventListeners() {
        const notesArea = document.getElementById(`notes-${this.groupId}`);
        if (notesArea) {
            // 移除现有的事件监听器
            const newNotesArea = notesArea.cloneNode(true);
            notesArea.parentNode.replaceChild(newNotesArea, notesArea);

            // 添加新的事件监听器
            newNotesArea.addEventListener('input', (e) => {
                this.notes = e.target.value;
                this.saveToLocalStorage();
            });

            // 自动调整文本区域高度
            newNotesArea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        }
    }

    // 保存到本地存储
    saveToLocalStorage() {
        const key = `orbital-viewer-notes-${this.groupId}`;
        localStorage.setItem(key, this.notes);
    }

    // 从本地存储加载
    loadFromLocalStorage() {
        const key = `orbital-viewer-notes-${this.groupId}`;
        const savedNotes = localStorage.getItem(key);
        if (savedNotes) {
            this.setNotes(savedNotes);
        }
    }

    // 获取配置数据
    getConfiguration() {
        return {
            notes: this.notes
        };
    }

    // 加载配置数据
    loadConfiguration(config) {
        if (config && (typeof config === 'string' || config.notes)) {
            const notesContent = typeof config === 'string' ? config : config.notes;
            this.setNotes(notesContent);
        }
    }
}

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
        this.fileName1 = '';
        this.fileName2 = '';
        this.basePath = '';
        this.showNegative = true;
        this.isInitialized = false;
        this.showCub1 = true;
        this.showCub2 = true;
        this.isColorMappingEnabled = false;
        
        // 初始化备注管理器
        this.notesManager = new NotesManager(this.id);
    }

    async initialize() {
        if (this.isInitialized) return;

        // 创建3Dmol查看器
        this.viewer = $3Dmol.createViewer(`viewer-${this.id}`, {
            backgroundColor: "white",
            id: `viewer-${this.id}`,
            defaultcolors: $3Dmol.rasmolElementColors,
            control: {
                dragScale: 0.5,
                scrollScale: 0.5,
                rotateSpeed: 0.5
            }
        });

        // 设置默认视图控制
        this.viewer.setStyle({}, {stick:{}, sphere:{}});
        this.viewer.setClickable({}, true, function(atom){
            console.log("Atom clicked: " + atom.elem + " " + atom.serial);
        });
        this.viewer.render();

        this.setupEventListeners();
        this.setupDropZone();
        
        // 初始化备注管理器
        await this.notesManager.initialize();
        
        this.isInitialized = true;

        // 等待DOM更新
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

    // 添加切换选项卡的函数
    switchTab(tabName) {
        // 获取所有选项卡按钮和内容
        const tabBtns = document.querySelectorAll(`#group-${this.id} .tab-btn`);
        const tabContents = document.querySelectorAll(`#group-${this.id} .tab-content`);
        
        // 移除所有active类
        tabBtns.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // 添加active类到选中的选项卡
        document.querySelector(`#group-${this.id} .tab-btn[onclick*="${tabName}"]`).classList.add('active');
        document.querySelector(`#group-${this.id} #${tabName}-tab-${this.id}`).classList.add('active');
    }

    // 添加切换染色模式的��法
    toggleColorMapping() {
        this.isColorMappingEnabled = !this.isColorMappingEnabled;
        
        // 更新颜色选择器的状态
        const color1Input = document.getElementById(`color1-${this.id}`);
        const color2Input = document.getElementById(`color2-${this.id}`);
        if (color1Input && color2Input) {
            color1Input.disabled = this.isColorMappingEnabled;
            color2Input.disabled = this.isColorMappingEnabled;
        }
        
        // 更新开关按钮的文本
        const toggleBtn = document.getElementById(`toggleColorMap-${this.id}`);
        if (toggleBtn) {
            toggleBtn.textContent = this.isColorMappingEnabled ? '关闭值映射' : '启用值映射';
            toggleBtn.classList.toggle('active', this.isColorMappingEnabled);
        }
        
        // 更新表面显示
        this.updateSurfaces();
    }

    takeScreenshot() {
        try {
            // 获取查看器的 canvas 元素
            const canvas = document.querySelector(`#viewer-${this.id} canvas`);
            if (!canvas) {
                throw new Error('找不到 canvas 元素');
            }

            // 创建一个新的 canvas 来处理截图
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
            // 创建的 toast 元素
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
        this.showCub1 = true;
        this.showCub2 = true;

        $(`#title-${this.id}`).val(config.title);
        $(`#color1-${this.id}`).val(config.color1);
        $(`#color2-${this.id}`).val(config.color2);
        $(`#isoValue-${this.id}`).val(config.isoValue);
        $(`#surfaceScale-${this.id}`).val(config.surfaceScale);
        $(`#scaleDisplay-${this.id}`).text(config.surfaceScale);

        // 更新文件名显示
        $(`#file1-label-${this.id}`).text(`文件 1: ${this.fileName1}`);
        $(`#file2-label-${this.id}`).text(`文件 2: ${this.fileName2 || ''}`);

        // 加载备注
        try {
            if (config.notes) {
                // 确保 notesManager 已经初始化
                if (!this.notesManager) {
                    this.notesManager = new NotesManager(this.id);
                }
                
                // 加载备注配置
                this.notesManager.loadConfiguration(config.notes);
                
                // 直接更新文本区域的值
                const notesArea = document.getElementById(`notes-${this.id}`);
                if (notesArea) {
                    notesArea.value = config.notes.notes || '';
                    // 触发一次 input 事件以调整高度
                    const event = new Event('input', {
                        bubbles: true,
                        cancelable: true,
                    });
                    notesArea.dispatchEvent(event);
                }
            }
        } catch (error) {
            console.error('加载备注时出错:', error);
        }

        // 如果至少有一个文件名，就开始加载
        if (this.fileName1) {
            setTimeout(() => this.autoLoadFiles(), 0);
        }
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
            fileName2: this.fileName2,
            notes: this.notesManager.getConfiguration()
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

        let dragCounter = 0; // 添加计数器避免闪烁

        // 文件拖放相关事件
        viewerEl.addEventListener('dragenter', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                dragCounter++;
                if (dragCounter === 1) { // 只在第一次进入时显示
                    dropZone.classList.add('active');
                }
                e.preventDefault();
                e.stopPropagation();
            }
        }, false);

        viewerEl.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, false);

        viewerEl.addEventListener('dragleave', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                dragCounter--;
                if (dragCounter === 0) { // 在完全离开时隐藏
                    dropZone.classList.remove('active');
                }
                e.preventDefault();
                e.stopPropagation();
            }
        }, false);

        viewerEl.addEventListener('drop', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                dragCounter = 0; // 重置计数器
                dropZone.classList.remove('active');
                e.preventDefault();
                e.stopPropagation();

                const files = Array.from(e.dataTransfer.files)
                    .filter(file => file.name.endsWith('.cube') || file.name.endsWith('.cub'));

                if (files.length > 0) {
                    this.handleFiles(files);
                }
            }
        }, false);
    }

    // 简化的文件排序方法
    sortFilesByName(files) {
        return files.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 处理文件
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

        // 加新文件
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

    // 读文件内容
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

        // 密度值输入
        $(`#isoValue-${this.id}`).on('change', function () {
            group.updateSurfaces();
        });

        // 修复第一个误：增加分号
        $(`#color1-${this.id}`).on('change', function () {
            group.color1 = this.value;
            group.updateSurfaces();
        });

        // 修复第二个错误：格式化和增加分号
        $(`#color2-${this.id}`).on('change', function () {
            group.color2 = this.value;
            group.updateSurfaces();
        });

        // 添加映射设置相关的事件监听器
        const mappingToggle = document.getElementById(`enableMapping-${this.id}`);
        if (mappingToggle) {
            mappingToggle.addEventListener('change', () => {
                this.toggleColorMapping();
            });
        }

        // 添加映射值和颜色变化的监听器
        ['minMapValue', 'maxMapValue', 'negativeColor', 'positiveColor'].forEach(id => {
            const element = document.getElementById(`${id}-${this.id}`);
            if (element) {
                element.addEventListener('change', () => {
                    this.updateColorMapping();
                });
            }
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

            // 仅当 fileName2 有实际值（非空字符串）时尝加载第二个文件
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

        const isoValue = parseFloat(document.getElementById(`isoValue-${this.id}`).value);

        if (this.currentData1) {
            if (this.isColorMappingEnabled && this.currentData2) {
                // 使用值映射模式
                const minValue = parseFloat(document.getElementById(`minMapValue-${this.id}`).value);
                const maxValue = parseFloat(document.getElementById(`maxMapValue-${this.id}`).value);
                const negativeColor = document.getElementById(`negativeColor-${this.id}`).value;
                const positiveColor = document.getElementById(`positiveColor-${this.id}`).value;

                // 使用 RDG 生成等值面，用 Sign(λ2)ρ 的值来映射颜色
                this.viewer.addVolumetricData(this.currentData1, "cube", {
                    isoval: isoValue,
                    voldata: this.currentData2,
                    volformat: "cube",
                    volscheme: {
                        gradient: "rwb",
                        min: minValue,
                        max: maxValue,
                        mid: 0
                    },
                    opacity: 0.85,
                    wireframe: false
                });
            } else {
                // 使用原来的显示模式
                if (this.showCub1) {
                    this.currentVolumeId1 = this.viewer.addVolumetricData(this.currentData1, "cube", {
                        isoval: isoValue,
                        color: this.color1,
                        opacity: 0.85,
                        wireframe: false,
                        origin: this.origin,
                        dimensional: true
                    });

                    const negativeColor = this.getComplementaryColor(this.color1);
                    this.viewer.addVolumetricData(this.currentData1, "cube", {
                        isoval: -isoValue,
                        color: negativeColor,
                        opacity: 0.85,
                        wireframe: false,
                        origin: this.origin,
                        dimensional: true
                    });
                }

                if (this.showCub2 && this.currentData2) {
                    this.currentVolumeId2 = this.viewer.addVolumetricData(this.currentData2, "cube", {
                        isoval: isoValue,
                        color: this.color2,
                        opacity: 0.85,
                        wireframe: false,
                        origin: this.origin,
                        dimensional: true
                    });

                    const negativeColor = this.getComplementaryColor(this.color2);
                    this.viewer.addVolumetricData(this.currentData2, "cube", {
                        isoval: -isoValue,
                        color: negativeColor,
                        opacity: 0.85,
                        wireframe: false,
                        origin: this.origin,
                        dimensional: true
                    });
                }
            }
        }

        this.viewer.render();
    }

    // 获取补的辅助方法
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

        // 转回十进制
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
        const elements = [
            "H", "He", 
            "Li", "Be", "B", "C", "N", "O", "F", "Ne",
            "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
            "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr",
            "Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe"
        ];
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
        return covalentRadii[element] || 0.76;  // 默认返回碳原子的半径
    }

    // 显示分子结构
    displayMolecule() {
        if (!this.viewer || this.atomList.length === 0) return;

        // 设置基准因子，于调整整体大小
        const RADIUS_SCALE = 0.4;  // 可以调整这个值来改变整体大小

        // 添加原子
        this.atomList.forEach(atom => {
            const color = atomColors[atom.elem] || '#808080';
            // 使用共价半径来设置原子大小
            const radius = (covalentRadii[atom.elem] || 0.76) * RADIUS_SCALE;  // 默认使用碳原子的半径
            
            this.viewer.addSphere({
                center: { x: atom.x, y: atom.y, z: atom.z },
                radius: radius,
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

                // 整键长判断标准，用共价半径之和的1.3倍作为阈值
                if (distance < (radius1 + radius2) * 1.3) {
                    // 根据原子大小调整键的粗细
                    const bondRadius = Math.min(radius1, radius2) * 0.25;  // 键的径设较小原子半径的1/4
                    
                    this.viewer.addCylinder({
                        start: { x: atom1.x, y: atom1.y, z: atom1.z },
                        end: { x: atom2.x, y: atom2.y, z: atom2.z },
                        radius: bondRadius,
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
        return `
            <div class="viewer-group" id="group-${this.id}">
                <div class="viewer-header">
                    <input type="text" class="title-input" id="title-${this.id}" value="${this.title}">
                    <div class="close-btn-container">
                        <button class="close-btn" onclick="viewerGroups[${this.id}].close()">×</button>
                    </div>
                </div>
                <div class="viewer-container">
                    <div class="viewer-controls">
                        <div class="tabs">
                            <button class="tab-btn active" data-tab="basic" onclick="switchTab(${this.id}, 'basic')">Basis</button>
                            <button class="tab-btn" data-tab="mapping" onclick="switchTab(${this.id}, 'mapping')">Mapping</button>
                            <button class="tab-btn" data-tab="notes" onclick="switchTab(${this.id}, 'notes')">Notes</button>
                        </div>
                        
                        <div id="basic-tab-${this.id}" class="tab-content active">
                            ${this.createBasicTabContent()}
                        </div>

                        <div id="mapping-tab-${this.id}" class="tab-content">
                            ${this.createMappingTabContent()}
                        </div>

                        <div id="notes-tab-${this.id}" class="tab-content">
                            <div class="notes-container">
                                <label class="notes-label" for="notes-${this.id}">备注:</label>
                                <textarea id="notes-${this.id}" 
                                    class="notes-area" 
                                    placeholder="在这里添加关于该轨道组的备注..."
                                ></textarea>
                            </div>
                        </div>

                        <div class="control-group">
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

    // 创建基础设置标签页内容
    createBasicTabContent() {
        const defaultSettings = (window.ORBITAL_VIEWER_CONFIG && window.ORBITAL_VIEWER_CONFIG.defaultSettings) || {
            isoValue: '0.002',
            surfaceScale: '1.0'
        };

        return `
            <div class="control-group">
                <div class="input-container">
                    <div>
                        <label for="isoValue-${this.id}">等值面值:</label>
                        <input type="number" id="isoValue-${this.id}" value="${defaultSettings.isoValue}" step="0.001">
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
            </div>
        `;
    }

    // 创建映射设置标签页内容
    createMappingTabContent() {
        const defaultSettings = (window.ORBITAL_VIEWER_CONFIG && window.ORBITAL_VIEWER_CONFIG.defaultSettings) || {
            minMapValue: '-0.02',
            maxMapValue: '0.03'
        };

        return `
            <div class="control-group">
                <div class="mapping-controls">
                    <button class="btn" id="toggleColorMap-${this.id}" onclick="viewerGroups[${this.id}].toggleColorMapping()">
                        启用值映射
                    </button>
                </div>
                <div class="mapping-range">
                    <div class="range-input">
                        <label>最小值:</label>
                        <input type="number" id="minMapValue-${this.id}" 
                               value="${defaultSettings.minMapValue}" 
                               step="0.001">
                    </div>
                    <div class="range-input">
                        <label>最大值:</label>
                        <input type="number" id="maxMapValue-${this.id}" 
                               value="${defaultSettings.maxMapValue}" 
                               step="0.001">
                    </div>
                </div>
                <div class="mapping-colors">
                    <div class="color-input">
                        <label>负值颜色:</label>
                        <input type="color" id="negativeColor-${this.id}" 
                               value="#0000FF">
                    </div>
                    <div class="color-input">
                        <label>正值颜色:</label>
                        <input type="color" id="positiveColor-${this.id}" 
                               value="#FF0000">
                    </div>
                </div>
            </div>
        `;
    }

    close() {
        try {
            console.log('开始删除轨道组:', this.id, this.title);
            
            // 1. 从 DOM 中移除
            const element = document.getElementById(`group-${this.id}`);
            if (!element) {
                console.error('找不到要删除的元素:', this.id);
                return;
            }
            element.remove();
            
            // 2. 从数组中移除
            const index = viewerGroups.indexOf(this);
            if (index === -1) {
                console.error('在 viewerGroups 中找不到要删除的组:', this.id);
                return;
            }
            viewerGroups.splice(index, 1);
            
            // 3. 新分配所有 id
            this.reassignIds();
            
            console.log('删除完成，当前轨道组数量:', viewerGroups.length);
            this.logState();
            
        } catch (error) {
            console.error('删除轨道组时出错:', error);
        }
    }
    
    // 添加重新分配 ID 的方法
    reassignIds() {
        viewerGroups.forEach((group, newId) => {
            const oldId = group.id;
            group.id = newId;
            
            // 更新 DOM 元素
            const element = document.querySelector(`#group-${oldId}`);
            if (element) {
                // 更新主容器 id
                element.id = `group-${newId}`;
                
                // 更新标题输入框
                const titleInput = element.querySelector('.title-input');
                if (titleInput) {
                    titleInput.id = `title-${newId}`;
                }
                
                // 更新查看器容器
                const viewer = element.querySelector('.viewer');
                if (viewer) {
                    viewer.id = `viewer-${newId}`;
                }
                
                // 更新颜色选择器
                const color1Input = element.querySelector(`input[id^="color1-"]`);
                if (color1Input) {
                    color1Input.id = `color1-${newId}`;
                }
                
                const color2Input = element.querySelector(`input[id^="color2-"]`);
                if (color2Input) {
                    color2Input.id = `color2-${newId}`;
                }
                
                // 更新等值面输入框
                const isoValueInput = element.querySelector(`input[id^="isoValue-"]`);
                if (isoValueInput) {
                    isoValueInput.id = `isoValue-${newId}`;
                }
                
                // 更新关闭按钮的 onclick ��件
                const closeBtn = element.querySelector('.close-btn');
                if (closeBtn) {
                    closeBtn.setAttribute('onclick', `viewerGroups[${newId}].close()`);
                }
                
                // 更新 CUB 切换按钮
                const toggleCub1Btn = element.querySelector(`button[id^="toggleCub1-"]`);
                if (toggleCub1Btn) {
                    toggleCub1Btn.id = `toggleCub1-${newId}`;
                    toggleCub1Btn.setAttribute('onclick', `viewerGroups[${newId}].toggleCub1()`);
                }
                
                const toggleCub2Btn = element.querySelector(`button[id^="toggleCub2-"]`);
                if (toggleCub2Btn) {
                    toggleCub2Btn.id = `toggleCub2-${newId}`;
                    toggleCub2Btn.setAttribute('onclick', `viewerGroups[${newId}].toggleCub2()`);
                }
            }
        });
    }
    
    // 添加状态日志方法
    logState() {
        console.log('当前状态:');
        console.log('ViewerGroups 数组:', viewerGroups.map(g => ({id: g.id, title: g.title})));
        
        const domGroups = document.querySelectorAll('.viewer-group');
        console.log('DOM 元:');
        domGroups.forEach(element => {
            const id = element.id.replace('group-', '');
            const titleInput = element.querySelector('.title-input');
            const title = titleInput ? titleInput.value : '未知';
            console.log(`- DOM ID: ${id}, 标题: ${title}`);
        });
    }

    updateColorMapping() {
        if (!this.isColorMappingEnabled) return;
        
        const minValue = parseFloat(document.getElementById(`minMapValue-${this.id}`).value);
        const maxValue = parseFloat(document.getElementById(`maxMapValue-${this.id}`).value);
        const negativeColor = document.getElementById(`negativeColor-${this.id}`).value;
        const positiveColor = document.getElementById(`positiveColor-${this.id}`).value;

        // 更新面显示
        this.updateSurfaces();
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
        globalTitle: document.getElementById('global-title').value,
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
    // 直接从 DOM 中获取所有查看器组
    const viewerElements = document.querySelectorAll('.viewer-group');
    if (viewerElements.length === 0) {
        alert('没有可用的轨道组！');
        return;
    }

    try {
        const finalCanvas = document.createElement('canvas');
        const ctx = finalCanvas.getContext('2d');

        // 缩放因子和间距
        const scale = 2;
        const padding = 40 * scale;
        const titleHeight = 80 * scale;
        const lineHeight = 2 * scale;
        const notesLineHeight = 36 * scale; // 备注的行高
        const maxNotesLines = 5; // 最大显示5行备注
        const notesHeight = notesLineHeight * maxNotesLines; // 备注区域高度

        // 获取所有有效的截图
        const screenshots = [];
        let maxWidth = 0;
        let maxHeight = 0;

        // 遍历所有查看器组元素
        for (const element of viewerElements) {
            // 获取查看器组的 canvas
            const canvas = element.querySelector('.viewer canvas');
            if (!canvas) continue;

            // 获取标题
            const titleInput = element.querySelector('.title-input');
            const title = titleInput ? titleInput.value : '';

            // 获取备注内容
            const notesArea = element.querySelector('.notes-area');
            const notes = notesArea ? notesArea.value : '';

            // 创建放大的临时画布
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width * scale;
            tempCanvas.height = (canvas.height + titleHeight + notesHeight + lineHeight * 3) * scale;
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
            tempCtx.font = `bold ${64 * scale}px Arial`;
            tempCtx.textAlign = 'center';
            tempCtx.textBaseline = 'middle';
            tempCtx.fillText(title, tempCanvas.width / 2, titleHeight / 2);

            // 绘制标题下方分割线
            tempCtx.beginPath();
            tempCtx.moveTo(0, titleHeight);
            tempCtx.lineTo(tempCanvas.width, titleHeight);
            tempCtx.stroke();

            // 添加备注
            if (notes) {
                tempCtx.font = `${36 * scale}px Arial`;
                tempCtx.fillStyle = '#666';
                tempCtx.textAlign = 'left';
                
                // 自动换行显示备注
                const words = notes.split(' ');
                let line = '';
                let y = titleHeight + notesLineHeight;
                let lineCount = 0;
                
                for (let i = 0; i < words.length && lineCount < maxNotesLines; i++) {
                    const testLine = line + words[i] + ' ';
                    const metrics = tempCtx.measureText(testLine);
                    const testWidth = metrics.width;

                    if (testWidth > tempCanvas.width - 40 * scale && i > 0) {
                        // 如果是最后一行且还有更多内容，添加省略号
                        if (lineCount === maxNotesLines - 1 && i < words.length - 1) {
                            tempCtx.fillText(line + '...', 20 * scale, y);
                        } else {
                            tempCtx.fillText(line, 20 * scale, y);
                        }
                        line = words[i] + ' ';
                        y += notesLineHeight;
                        lineCount++;
                    } else {
                        line = testLine;
                    }
                }
                
                // 绘制最后一行
                if (line && lineCount < maxNotesLines) {
                    tempCtx.fillText(line, 20 * scale, y);
                }
            }

            // 绘制备注下方分割线
            tempCtx.beginPath();
            tempCtx.moveTo(0, titleHeight + notesHeight + lineHeight);
            tempCtx.lineTo(tempCanvas.width, titleHeight + notesHeight + lineHeight);
            tempCtx.stroke();

            // 绘制内容
            tempCtx.save();
            tempCtx.translate(0, titleHeight + notesHeight + lineHeight * 2);
            tempCtx.scale(scale, scale);
            tempCtx.drawImage(canvas, 0, 0);
            tempCtx.restore();

            screenshots.push({
                canvas: tempCanvas,
                width: tempCanvas.width,
                height: tempCanvas.height
            });

            maxWidth = Math.max(maxWidth, tempCanvas.width);
            maxHeight = Math.max(maxHeight, tempCanvas.height);
        }

        // 计算网格布局
        const { rows, cols } = calculateGridDimensions(screenshots.length);

        // 计算最终画布的大小
        const totalWidth = (maxWidth + padding) * cols - padding;
        const totalHeight = (maxHeight + padding) * rows - padding;

        // 设置最终画布的大小
        finalCanvas.width = totalWidth + padding * 2;
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

            // 先初始化看器
            newGroup.initialize();

            // 然后载配置
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

// 添加 DOMContentLoaded 件监听器
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
        console.log('没有检测到配置数据，创建默认看器组');
        addNewViewerGroup();
    }
});

// 添加状态验证函数
function validateViewerGroupsState() {
    const domGroups = document.querySelectorAll('.viewer-group');
    
    // 检查 DOM 和数组长度是否匹配
    if (domGroups.length !== viewerGroups.length) {
        console.error('DOM 和 viewerGroups 数组长度不匹配');
        console.log(`DOM: ${domGroups.length}, Array: ${viewerGroups.length}`);
    }
    
    // 检查每个元素的 ID 是否正确
    domGroups.forEach((element, index) => {
        const domId = parseInt(element.id.replace('group-', ''));
        const arrayId = viewerGroups[index].id;
        
        if (domId !== arrayId) {
            console.error(`ID 不匹配 - DOM: ${domId}, Array: ${arrayId}`);
        }
    });
}

// 添加全局 switchTab 函数
function switchTab(groupId, tabName) {
    // 获取所有选项卡按钮和内容
    const tabBtns = document.querySelectorAll(`#group-${groupId} .tab-btn`);
    const tabContents = document.querySelectorAll(`#group-${groupId} .tab-content`);
    
    // 移除所有active类
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // 添加active类到选中的选项��
    document.querySelector(`#group-${groupId} .tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.querySelector(`#group-${groupId} #${tabName}-tab-${groupId}`).classList.add('active');
}

// 修改 setupControls 方法
function setupControls() {
    ['isoValue', 'minValue', 'maxValue', 'negativeColor', 'positiveColor'].forEach(id => {
        document.getElementById(`${id}-${this.id}`).addEventListener('change', () => this.updateSurfaces());
    });
}

