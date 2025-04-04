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

    // 添加切换染色模式的方法
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
            const screenshotManager = new ScreenshotManager();
            screenshotManager.captureViewer(document.querySelector(`#group-${this.id}`)).then(screenshot => {
                if (screenshot) {
                    screenshot.canvas.toBlob((blob) => {
                        const item = new ClipboardItem({ "image/png": blob });
                        navigator.clipboard.write([item]).then(() => {
                            this.showToast('截图已复制到剪贴板');
                        }).catch((err) => {
                            console.error('复制到剪贴板失败:', err);
                            this.showError('复制到剪贴板失败');
                        });
                    }, 'image/png');
                }
            });
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

        // 如果当前已有两个文件，则清空表重新开始
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

                // 更新显示以含第二个文件
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

        // 转回十制
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
        // 查找此查看器在数组中的索引
        const index = viewerGroups.findIndex(group => group.id === this.id);
        if (index !== -1) {
            // 从数组中移除此查看器
            viewerGroups.splice(index, 1);
            
            // 从DOM中移除此查看器的HTML元素
            const element = document.getElementById(`group-${this.id}`);
            if (element) {
                element.remove();
            }
            // 重新分配其他查看器的ID
            reassignIds();
        }
    }

    static reassignIds() {
        // 重新分配数组中所有元素的ID
        viewerGroups.forEach((group, index) => {
            group.id = index;
            // 找到对应的 DOM 元素并更新 ID
            const element = document.getElementById(`group-${group.id}`);
            if (element) {
                // 更新查看器 ID
                const viewer = element.querySelector('.viewer');
                if (viewer) {
                    viewer.id = `viewer-${index}`;
                }
                // 更新标题输入框
                const titleInput = element.querySelector('.title-input');
                if (titleInput) {
                    titleInput.id = `title-${index}`;
                }
                // 更新关闭按钮的 onclick 事件
                const closeBtn = element.querySelector('.close-btn');
                if (closeBtn) {
                    closeBtn.setAttribute('onclick', `viewerGroups[${index}].close()`);
                }
                // 更新颜色选择器
                const color1Input = element.querySelector(`input[id^="color1-"]`);
                if (color1Input) {
                    color1Input.id = `color1-${index}`;
                }
                const color2Input = element.querySelector(`input[id^="color2-"]`);
                if (color2Input) {
                    color2Input.id = `color2-${index}`;
                }
                // 更新等值面输入框
                const isoValueInput = element.querySelector(`input[id^="isoValue-"]`);
                if (isoValueInput) {
                    isoValueInput.id = `isoValue-${index}`;
                }
                // 更新 CUB 切换按钮
                const toggleCub1Btn = element.querySelector(`button[id^="toggleCub1-"]`);
                if (toggleCub1Btn) {
                    toggleCub1Btn.id = `toggleCub1-${index}`;
                    toggleCub1Btn.setAttribute('onclick', `viewerGroups[${index}].toggleCub1()`);
                }
                const toggleCub2Btn = element.querySelector(`button[id^="toggleCub2-"]`);
                if (toggleCub2Btn) {
                    toggleCub2Btn.id = `toggleCub2-${index}`;
                    toggleCub2Btn.setAttribute('onclick', `viewerGroups[${index}].toggleCub2()`);
                }
            }
        });
    }

    logState() {
        console.log('当前状态:');
        console.log('ViewerGroups 数组:', viewerGroups.map(g => ({id: g.id, title: g.title})));
        
        const domGroups = document.querySelectorAll('.viewer-group');
        console.log('DOM 元素:');
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

        // 更新表面显示
        this.updateSurfaces();
    }
}
