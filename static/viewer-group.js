class ViewerGroup {
    constructor(id) {
        this.id = id;
        this.viewer = null;
        this.currentData1 = null;
        this.currentData2 = null;
        this.isUpdatingView = false;  // 防止无限循环的标志

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
        // 记录当前等值面（3Dmol 的 addVolumetricData/addIsosurface 生成的是 GLShape）
        // 需要用 viewer.removeShape() 移除；否则旧等值面会残留，导致修改等值面值看似无效
        this.isoShapes = [];
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

    // 获取当前视角状态
    getViewState() {
        if (!this.viewer) return null;
        // 使用正确的 3Dmol API
        return this.viewer.getView();
    }

    // 设置视角状态
    setViewState(state, sourceId) {
        if (!this.viewer || this.isUpdatingView || this.id === sourceId) return;
        
        this.isUpdatingView = true;
        try {
            // 使用正确的 3Dmol API
            this.viewer.setView(state);
            this.viewer.render();
        } finally {
            this.isUpdatingView = false;
        }
    }

    // 复制当前视角参数到剪贴板（转换为VMD格式）
    async copyViewState() {
        const state = this.getViewState();
        if (!state) {
            this.showError('当前视角不可用');
            return;
        }

        try {
            // 显示处理中提示
            this.showToast('正在转换视角格式...');
            
            // 调用服务器端API进行转换
            const response = await fetch('/convert-view', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(state)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`转换失败: ${errorText}`);
            }
            
            const result = await response.json();
            const vmd_string = result.vmd_string;
            
            // 复制到剪贴板
            await navigator.clipboard.writeText(vmd_string);
            this.showToast('VMD视角已复制到剪贴板');
            
        } catch (error) {
            console.error('复制视角失败:', error);
            this.showError('复制视角失败: ' + error.message);
        }
    }

    // 导出当前视角参数为 JSON
    exportViewState() {
        const state = this.getViewState();
        if (!state) {
            this.showError('当前视角不可用');
            return;
        }

        try {
            const json = JSON.stringify(state, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.href = url;
            a.download = `viewer-${this.id}-view-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('视角参数已导出');
        } catch (error) {
            console.error('导出视角失败:', error);
            this.showError('导出视角失败');
        }
    }

    // 触发读取视角文件
    triggerViewStateImport() {
        const input = document.getElementById(`viewStateInput-${this.id}`);
        if (input) {
            input.value = '';
            input.click();
        }
    }

    // 处理视角文件导入
    async handleViewStateFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const state = JSON.parse(text);
            if (!state || typeof state !== 'object') {
                throw new Error('视角数据格式错误');
            }
            this.setViewState(state);
            this.showToast('视角参数已加载');
        } catch (error) {
            console.error('加载视角失败:', error);
            this.showError('加载视角失败，请检查文件格式');
        } finally {
            event.target.value = '';
        }
    }

    initialize() {
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
        // 如需调试点击原子，可在这里打开日志
        // this.viewer.setClickable({}, true, function(atom){
        //     console.log("Atom clicked: " + atom.elem + " " + atom.serial);
        // });
        this.viewer.render();

        this.setupEventListeners();
        this.setupDropZone();
        
        // 初始化备注管理器
        this.notesManager.initialize();
        
        this.isInitialized = true;
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

        // 加载值映射配置
        if (config.isColorMappingEnabled !== undefined) {
            this.isColorMappingEnabled = config.isColorMappingEnabled;
            
            // 更新值映射相关的UI元素
            const minMapValueEl = document.getElementById(`minMapValue-${this.id}`);
            const maxMapValueEl = document.getElementById(`maxMapValue-${this.id}`);
            const negativeColorEl = document.getElementById(`negativeColor-${this.id}`);
            const positiveColorEl = document.getElementById(`positiveColor-${this.id}`);
            const color1Input = document.getElementById(`color1-${this.id}`);
            const color2Input = document.getElementById(`color2-${this.id}`);
            const toggleBtn = document.getElementById(`toggleColorMap-${this.id}`);
            
            if (minMapValueEl && config.minMapValue !== undefined) {
                minMapValueEl.value = config.minMapValue;
            }
            if (maxMapValueEl && config.maxMapValue !== undefined) {
                maxMapValueEl.value = config.maxMapValue;
            }
            if (negativeColorEl && config.negativeColor !== undefined) {
                negativeColorEl.value = config.negativeColor;
            }
            if (positiveColorEl && config.positiveColor !== undefined) {
                positiveColorEl.value = config.positiveColor;
            }
            
            // 更新颜色选择器的禁用状态和按钮状态
            if (color1Input && color2Input) {
                color1Input.disabled = this.isColorMappingEnabled;
                color2Input.disabled = this.isColorMappingEnabled;
            }
            if (toggleBtn) {
                toggleBtn.textContent = this.isColorMappingEnabled ? '关闭值映射' : '启用值映射';
                toggleBtn.classList.toggle('active', this.isColorMappingEnabled);
            }
        }

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
            notes: this.notesManager.getConfiguration(),
            // 值映射相关配置
            isColorMappingEnabled: this.isColorMappingEnabled,
            minMapValue: document.getElementById(`minMapValue-${this.id}`)?.value || '-0.02',
            maxMapValue: document.getElementById(`maxMapValue-${this.id}`)?.value || '0.03',
            negativeColor: document.getElementById(`negativeColor-${this.id}`)?.value || '#0000FF',
            positiveColor: document.getElementById(`positiveColor-${this.id}`)?.value || '#FF0000'
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

        // 如果当前已有两个文件，则清空列表并重置显示
        if (this.uploadedFiles.length >= 2) {
            this.uploadedFiles = [];
            this.currentData1 = null;
            this.currentData2 = null;
            this.atomList = [];
            this.fileName1 = '';
            this.fileName2 = '';
            this.resetViewer();
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
                }

                // 显示分子和轨道
                this.resetViewer();
                this.displayMolecule();
                this.updateSurfaces();
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
        ['minMapValue', 'maxMapValue', 'negativeColor', 'positiveColor', 'gradientType'].forEach(id => {
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
            // 加载配置时可能已经存在旧内容，先清理
            this.resetViewer();

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

        } catch (error) {
            console.error('文件加载错误:', error);
            this.showError(error.message);
        }
    }
    // 清理等值面/分子图形（加载新文件时用）
    resetViewer() {
        if (!this.viewer) return;
        try {
            // 只清理视觉对象，不改变相机状态
            if (typeof this.viewer.removeAllSurfaces === 'function') {
                this.viewer.removeAllSurfaces();
            }
            if (typeof this.viewer.removeAllShapes === 'function') {
                this.viewer.removeAllShapes();
            } else if (typeof this.viewer.clear === 'function') {
                // 兼容旧版本
                this.viewer.clear();
            }

            // reset 时一并清空等值面引用
            this.isoShapes = [];
        } catch (e) {
            console.warn('resetViewer failed:', e);
        }
    }

    // 更新表面（仅重建等值面，不重绘分子）
    updateSurfaces() {
        if (!this.viewer) return;

        // 只移除已有等值面，保留分子结构/相机视角
        // 注意：3Dmol 的 addVolumetricData/addIsosurface 生成的是 GLShape（存放在 viewer.shapes），
        // 不能用 removeAllSurfaces() 来清理，否则旧等值面会残留，导致 isoval 修改无效。
        if (typeof this.viewer.removeShape === 'function') {
            if (Array.isArray(this.isoShapes) && this.isoShapes.length) {
                for (const s of this.isoShapes) {
                    try {
                        this.viewer.removeShape(s);
                    } catch (e) {
                        // 忽略单个 shape 删除失败
                    }
                }
            }
            this.isoShapes = [];
        } else {
            // 极端兼容：没有 removeShape 时，只能清空重绘（会丢失分子，需要重绘）
            const prevView = (typeof this.viewer.getView === 'function') ? this.viewer.getView() : null;

            if (typeof this.viewer.removeAllShapes === 'function') {
                this.viewer.removeAllShapes();
            } else if (typeof this.viewer.clear === 'function') {
                this.viewer.clear();
            }

            this.isoShapes = [];
            this.displayMolecule();

            if (prevView && typeof this.viewer.setView === 'function') {
                this.viewer.setView(prevView);
            }
        }

        // 如果项目里还使用了传统 surface（viewer.surfaces），也顺手清理
        if (typeof this.viewer.removeAllSurfaces === 'function') {
            this.viewer.removeAllSurfaces();
        }

        const isoEl = document.getElementById(`isoValue-${this.id}`);
        let isoValue = isoEl ? parseFloat(isoEl.value) : 0.002;
        if (!Number.isFinite(isoValue)) isoValue = 0.002;

        if (!this.currentData1) {
            this.viewer.render();
            return;
        }

        if (this.isColorMappingEnabled && this.currentData2) {
            // 值映射模式：用 cub2 的值映射颜色，cub1 决定几何等值面
            const minValue = parseFloat(document.getElementById(`minMapValue-${this.id}`)?.value ?? '-0.02');
            const maxValue = parseFloat(document.getElementById(`maxMapValue-${this.id}`)?.value ?? '0.03');
            const gradientType = document.getElementById(`gradientType-${this.id}`)?.value || 'rwb';

            const shape = this.viewer.addVolumetricData(this.currentData1, 'cube', {
                isoval: isoValue,
                voldata: this.currentData2,
                volformat: 'cube',
                volscheme: {
                    gradient: gradientType,
                    min: minValue,
                    max: maxValue,
                    mid: 0
                },
                opacity: 0.85,
                wireframe: false
            });
            if (shape) this.isoShapes.push(shape);
        } else {
            // 经典模式：分别显示 cub1/cub2 的正负等值面
            if (this.showCub1) {
                const s1 = this.viewer.addVolumetricData(this.currentData1, 'cube', {
                    isoval: isoValue,
                    color: this.color1,
                    opacity: 0.85,
                    wireframe: false,
                    origin: this.origin,
                    dimensional: true
                });
                if (s1) this.isoShapes.push(s1);

                const neg1 = this.getComplementaryColor(this.color1);
                const s2 = this.viewer.addVolumetricData(this.currentData1, 'cube', {
                    isoval: -isoValue,
                    color: neg1,
                    opacity: 0.85,
                    wireframe: false,
                    origin: this.origin,
                    dimensional: true
                });
                if (s2) this.isoShapes.push(s2);
            }

            if (this.showCub2 && this.currentData2) {
                const s3 = this.viewer.addVolumetricData(this.currentData2, 'cube', {
                    isoval: isoValue,
                    color: this.color2,
                    opacity: 0.85,
                    wireframe: false,
                    origin: this.origin,
                    dimensional: true
                });
                if (s3) this.isoShapes.push(s3);

                const neg2 = this.getComplementaryColor(this.color2);
                const s4 = this.viewer.addVolumetricData(this.currentData2, 'cube', {
                    isoval: -isoValue,
                    color: neg2,
                    opacity: 0.85,
                    wireframe: false,
                    origin: this.origin,
                    dimensional: true
                });
                if (s4) this.isoShapes.push(s4);
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
    // 解析 Cube 文件（只解析头部+原子段，避免对整文件 split 导致的高内存/耗时）
    parseCubeFile(data) {
        try {
            if (typeof data !== 'string' || data.length === 0) return [];

            let idx = 0;
            const readLine = () => {
                const next = data.indexOf('\n', idx);
                if (next === -1) {
                    const line = data.slice(idx).replace(/\r$/, '').trim();
                    idx = data.length;
                    return line;
                }
                const line = data.slice(idx, next).replace(/\r$/, '').trim();
                idx = next + 1;
                return line;
            };

            // 前两行通常是注释
            readLine();
            readLine();

            // 第三行：原子数 + 原点坐标
            const third = readLine();
            const thirdParts = third.split(/\s+/);
            const natoms = Math.abs(parseInt(thirdParts[0], 10)) || 0;

            this.origin = {
                x: parseFloat(thirdParts[1]) || 0,
                y: parseFloat(thirdParts[2]) || 0,
                z: parseFloat(thirdParts[3]) || 0
            };

            // 3 行网格向量
            this.gridVectors = [];
            for (let i = 0; i < 3; i++) {
                const gridLine = readLine();
                const p = gridLine.split(/\s+/);
                this.gridVectors.push({
                    nx: parseInt(p[0], 10) || 0,
                    x: parseFloat(p[1]) || 0,
                    y: parseFloat(p[2]) || 0,
                    z: parseFloat(p[3]) || 0
                });
            }

            // 原子段：只读取 natoms 行即可
            const bohrToAng = 0.529177;
            const atoms = [];
            for (let i = 0; i < natoms; i++) {
                const line = readLine();
                if (!line) break;
                const parts = line.split(/\s+/);
                const atomicNumber = parseInt(parts[0], 10);

                atoms.push({
                    elem: this.getElementSymbol(atomicNumber),
                    x: (parseFloat(parts[2]) || 0) * bohrToAng,
                    y: (parseFloat(parts[3]) || 0) * bohrToAng,
                    z: (parseFloat(parts[4]) || 0) * bohrToAng
                });
            }

            return atoms;
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

        // 添加化学键（使用空间哈希，避免 O(n^2) 在大体系上卡顿）
        const atoms = this.atomList;
        if (atoms.length > 1) {
            // 以本体系中最大的共价半径估计最大键长阈值，用于设置网格尺寸
            let maxR = 0.76;
            for (let i = 0; i < atoms.length; i++) {
                const r = this.getCovalentRadius(atoms[i].elem);
                if (r > maxR) maxR = r;
            }

            // 原逻辑：阈值 = (r1 + r2) * 1.3
            const cellSize = Math.max(0.5, maxR * 2 * 1.3);
            const grid = new Map();
            const keyOf = (ix, iy, iz) => `${ix},${iy},${iz}`;

            // 建立空间网格索引
            for (let i = 0; i < atoms.length; i++) {
                const a = atoms[i];
                const ix = Math.floor(a.x / cellSize);
                const iy = Math.floor(a.y / cellSize);
                const iz = Math.floor(a.z / cellSize);
                const k = keyOf(ix, iy, iz);
                let bucket = grid.get(k);
                if (!bucket) {
                    bucket = [];
                    grid.set(k, bucket);
                }
                bucket.push(i);
            }

            // 只检查相邻 27 个网格
            for (let i = 0; i < atoms.length; i++) {
                const a1 = atoms[i];
                const ix = Math.floor(a1.x / cellSize);
                const iy = Math.floor(a1.y / cellSize);
                const iz = Math.floor(a1.z / cellSize);

                const r1 = this.getCovalentRadius(a1.elem);

                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dz = -1; dz <= 1; dz++) {
                            const bucket = grid.get(keyOf(ix + dx, iy + dy, iz + dz));
                            if (!bucket) continue;

                            for (let bi = 0; bi < bucket.length; bi++) {
                                const j = bucket[bi];
                                if (j <= i) continue;

                                const a2 = atoms[j];
                                const r2 = this.getCovalentRadius(a2.elem);

                                const maxDist = (r1 + r2) * 1.3;
                                // 快速排除：如果某一轴差值已经超过 maxDist，就不必算平方根
                                const dxp = a1.x - a2.x;
                                if (Math.abs(dxp) > maxDist) continue;
                                const dyp = a1.y - a2.y;
                                if (Math.abs(dyp) > maxDist) continue;
                                const dzp = a1.z - a2.z;
                                if (Math.abs(dzp) > maxDist) continue;

                                const distance = Math.sqrt(dxp * dxp + dyp * dyp + dzp * dzp);
                                if (distance < maxDist) {
                                    // 根据原子大小调整键的粗细
                                    const bondRadius = Math.min(r1, r2) * 0.25;

                                    this.viewer.addCylinder({
                                        start: { x: a1.x, y: a1.y, z: a1.z },
                                        end: { x: a2.x, y: a2.y, z: a2.z },
                                        radius: bondRadius,
                                        fromCap: true,
                                        toCap: true,
                                        color: 'lightgray'
                                    });
                                }
                            }
                        }
                    }
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
                            <div class="button-row">
                                <button class="btn screenshot-btn" onclick="viewerGroups[${this.id}].takeScreenshot()">
                                    截图
                                </button>
                                <button class="btn" onclick="viewerGroups[${this.id}].copyViewState()">
                                    复制视角
                                </button>
                            </div>
                            <div class="button-row">
                                <button class="btn" onclick="viewerGroups[${this.id}].exportViewState()">
                                    导出视角
                                </button>
                                <button class="btn" onclick="viewerGroups[${this.id}].triggerViewStateImport()">
                                    导入视角
                                </button>
                            </div>
                            <input type="file" 
                                id="viewStateInput-${this.id}" 
                                accept="application/json" 
                                style="display:none" 
                                onchange="viewerGroups[${this.id}].handleViewStateFile(event)">
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
                        <label>渐变样式:</label>
                        <select id="gradientType-${this.id}" style="width: 100%; padding: 4px;">
                            <option value="rwb">RWB (红-白-蓝)</option>
                            <option value="bwr">BWR (蓝-白-红)</option>
                            <option value="roygb">ROYGB (彩虹)</option>
                            <option value="sinebow">Sinebow (正弦彩虹)</option>
                        </select>
                    </div>
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
        if (index === -1) return;

        // 从数组中移除此查看器
        viewerGroups.splice(index, 1);
        
        // 从DOM中移除此查看器的HTML元素
        const element = document.getElementById(`group-${this.id}`);
        if (element) {
            element.remove();
        }

        // 重新分配其他查看器的ID
        ViewerGroup.reassignIds();
    }

    static reassignIds() {
        viewerGroups.forEach((group, index) => {
            if (group.id === index) return;

            const oldId = group.id;
            const container = document.getElementById(`group-${oldId}`);
            group.id = index;

            if (group.notesManager && typeof group.notesManager.updateGroupId === 'function') {
                group.notesManager.updateGroupId(index);
            }

            if (!container) return;

            // 更新容器 ID
            container.id = `group-${index}`;

            // 更新所有依赖 ID 的元素
            const idMappings = [
                { selector: `#viewer-${oldId}`, newId: `viewer-${index}` },
                { selector: `#title-${oldId}`, newId: `title-${index}` },
                { selector: `#file1-label-${oldId}`, newId: `file1-label-${index}` },
                { selector: `#file2-label-${oldId}`, newId: `file2-label-${index}` },
                { selector: `#color1-${oldId}`, newId: `color1-${index}` },
                { selector: `#color2-${oldId}`, newId: `color2-${index}` },
                { selector: `#isoValue-${oldId}`, newId: `isoValue-${index}` },
                { selector: `#toggleCub1-${oldId}`, newId: `toggleCub1-${index}` },
                { selector: `#toggleCub2-${oldId}`, newId: `toggleCub2-${index}` },
                { selector: `#toggleColorMap-${oldId}`, newId: `toggleColorMap-${index}` },
                { selector: `#minMapValue-${oldId}`, newId: `minMapValue-${index}` },
                { selector: `#maxMapValue-${oldId}`, newId: `maxMapValue-${index}` },
                { selector: `#negativeColor-${oldId}`, newId: `negativeColor-${index}` },
                { selector: `#positiveColor-${oldId}`, newId: `positiveColor-${index}` },
                { selector: `#notes-${oldId}`, newId: `notes-${index}` },
                { selector: `#basic-tab-${oldId}`, newId: `basic-tab-${index}` },
                { selector: `#mapping-tab-${oldId}`, newId: `mapping-tab-${index}` },
                { selector: `#notes-tab-${oldId}`, newId: `notes-tab-${index}` }
            ];

            idMappings.forEach(({ selector, newId }) => {
                const target = container.querySelector(selector);
                if (target) {
                    target.id = newId;
                }
            });

            // 更新按钮的 onclick 处理
            const buttonHandlers = [
                { selector: '.close-btn', handler: `viewerGroups[${index}].close()` },
                { selector: '.screenshot-btn', handler: `viewerGroups[${index}].takeScreenshot()` },
                { selector: `#toggleCub1-${index}`, handler: `viewerGroups[${index}].toggleCub1()` },
                { selector: `#toggleCub2-${index}`, handler: `viewerGroups[${index}].toggleCub2()` },
                { selector: `#toggleColorMap-${index}`, handler: `viewerGroups[${index}].toggleColorMapping()` }
            ];

            // 更新视角相关按钮的 onclick（通过文本内容匹配）
            const viewButtons = container.querySelectorAll('.btn');
            viewButtons.forEach(btn => {
                const text = btn.textContent.trim();
                if (text === '复制视角') {
                    btn.setAttribute('onclick', `viewerGroups[${index}].copyViewState()`);
                } else if (text === '导出视角') {
                    btn.setAttribute('onclick', `viewerGroups[${index}].exportViewState()`);
                } else if (text === '导入视角') {
                    btn.setAttribute('onclick', `viewerGroups[${index}].triggerViewStateImport()`);
                }
            });

            buttonHandlers.forEach(({ selector, handler }) => {
                const btn = container.querySelector(selector);
                if (btn) {
                    btn.setAttribute('onclick', handler);
                }
            });

            // 更新选项卡按钮的 onclick
            const tabButtons = container.querySelectorAll('.tab-btn');
            tabButtons.forEach((btn) => {
                const tabName = btn.getAttribute('data-tab');
                if (tabName) {
                    btn.setAttribute('onclick', `switchTab(${index}, '${tabName}')`);
                }
            });
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
        // 配置变化后直接重绘等值面即可
        this.updateSurfaces();
    }
}
