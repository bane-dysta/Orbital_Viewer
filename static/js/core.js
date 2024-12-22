// Core file
// 导入必要的依赖
import { calculateGridDimensions, getComplementaryColor } from './utils.js';
import { parseCubeFile, validateCubeFormat } from './file-handler.js';
import { createViewerGroupHTML } from './ui.js';
import { FILE_CONSTANTS, DEFAULT_SETTINGS } from './constants.js';

// ViewerGroup 类定义
export class ViewerGroup {
    constructor(id) {
        this.id = id;
        this.viewer = null;
        this.atoms = [];
        this.files = [];
        this.isColorMapping = false;
        this.showCub1 = true;
        this.showCub2 = true;
        this.currentVolumeId1 = null;
        this.currentVolumeId2 = null;
        this.color1 = DEFAULT_SETTINGS.color1;
        this.color2 = DEFAULT_SETTINGS.color2;
        this.initialize();
    }

    initialize() {
        try {
            // 初始化3Dmol.js查看器
            let element = document.getElementById(`viewer-${this.id}`);
            this.viewer = $3Dmol.createViewer(element, {
                backgroundColor: 'white',
                id: `viewer-${this.id}`,
                defaultcolors: $3Dmol.rasmolElementColors
            });
            
            if (!this.viewer) {
                throw new Error('无法初始化3D查看器');
            }

            // 设置默认视图
            this.viewer.setStyle({}, {
                stick: { radius: 0.1 },
                sphere: { radius: 0.4 }
            });
            this.viewer.zoomTo();
            this.viewer.render();

            // 设置事件监听
            this.setupEventListeners();

        } catch (error) {
            console.error('初始化查看器失败:', error);
            showError('初始化查看器失败: ' + error.message);
        }
    }

    setupEventListeners() {
        // 颜色选择器事件
        const color1Input = document.getElementById(`color1-${this.id}`);
        const color2Input = document.getElementById(`color2-${this.id}`);
        if (color1Input) color1Input.addEventListener('change', (e) => {
            this.color1 = e.target.value;
            this.updateSurfaces();
        });
        if (color2Input) color2Input.addEventListener('change', (e) => {
            this.color2 = e.target.value;
            this.updateSurfaces();
        });

        // 等值面值事件
        const isoValueInput = document.getElementById(`isoValue-${this.id}`);
        if (isoValueInput) isoValueInput.addEventListener('change', () => {
            this.updateSurfaces();
        });
    }

    async handleFiles(files) {
        try {
            showLoading(this.id);
            
            // 验证文件
            if (!files || files.length === 0) {
                throw new Error('没有选择文件');
            }

            if (files.length > 2) {
                throw new Error('最多只能加载两个文件');
            }

            // 清除现有分子
            this.clearMolecule();

            // 处理文件
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // 验证文件类型
                if (!file.name.toLowerCase().endsWith('.cube') && !file.name.toLowerCase().endsWith('.cub')) {
                    throw new Error(`文件 ${file.name} 不是有效的CUBE文件`);
                }

                // 读取文件内容
                const content = await this.readFile(file);
                
                // 验证文件格式
                if (!validateCubeFormat(content)) {
                    throw new Error(`文件 ${file.name} 格式不正确`);
                }

                // 解析文件
                const atoms = parseCubeFile(content);
                
                // 更新文件标签
                updateFileLabel(this.id, i + 1, file.name);
                
                // 存储文件信息
                this.files[i] = {
                    name: file.name,
                    content: content,
                    atoms: atoms
                };
            }

            // 显示分子
            await this.displayMolecule();
            
            // 更新表面
            this.updateSurfaces();

        } catch (error) {
            console.error('处理文件失败:', error);
            showError('处理文件失败: ' + error.message);
        } finally {
            hideLoading(this.id);
        }
    }

    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('读取文件失败'));
            reader.readAsText(file);
        });
    }

    async displayMolecule() {
        try {
            if (!this.files || this.files.length === 0) {
                throw new Error('没有可显示的分子');
            }

            // 清除现有显示
            this.viewer.clear();

            // 显示每个文件的原子
            for (let file of this.files) {
                if (file && file.atoms) {
                    for (let atom of file.atoms) {
                        // 创建原子模型
                        let atomSpec = {
                            elem: atom.symbol,
                            x: atom.x * FILE_CONSTANTS.bohrToAngstrom,
                            y: atom.y * FILE_CONSTANTS.bohrToAngstrom,
                            z: atom.z * FILE_CONSTANTS.bohrToAngstrom
                        };
                        
                        // 添加原子到查看器
                        this.viewer.addModel();
                        this.viewer.addAtoms([atomSpec]);
                    }
                }
            }

            // 设置样式和渲染
            this.viewer.setStyle({}, {
                stick: { radius: 0.1 },
                sphere: { radius: 0.4 }
            });
            this.viewer.zoomTo();
            this.viewer.render();

        } catch (error) {
            console.error('显示分子失败:', error);
            showError('显示分子失败: ' + error.message);
        }
    }

    updateSurfaces() {
        try {
            if (!this.viewer) return;

            // 清除现有表面
            this.viewer.clear();
            
            // 重新显示分子
            this.displayMolecule();

            // 获取等值面值
            const isoValue = parseFloat(document.getElementById(`isoValue-${this.id}`).value);

            // 处理第一个文件
            if (this.files[0] && this.showCub1) {
                // 添加正值表面
                this.currentVolumeId1 = this.viewer.addVolumetricData(this.files[0].content, "cube", {
                    isoval: isoValue,
                    color: this.color1,
                    opacity: 0.85,
                    wireframe: false
                });

                // 添加负值表面
                const negativeColor = getComplementaryColor(this.color1);
                this.viewer.addVolumetricData(this.files[0].content, "cube", {
                    isoval: -isoValue,
                    color: negativeColor,
                    opacity: 0.85,
                    wireframe: false
                });
            }

            // 处理第二个文件
            if (this.files[1] && this.showCub2) {
                // 添加正值表面
                this.currentVolumeId2 = this.viewer.addVolumetricData(this.files[1].content, "cube", {
                    isoval: isoValue,
                    color: this.color2,
                    opacity: 0.85,
                    wireframe: false
                });

                // 添加负值表面
                const negativeColor = getComplementaryColor(this.color2);
                this.viewer.addVolumetricData(this.files[1].content, "cube", {
                    isoval: -isoValue,
                    color: negativeColor,
                    opacity: 0.85,
                    wireframe: false
                });
            }

            // 渲染
            this.viewer.render();

        } catch (error) {
            console.error('更新表面失败:', error);
            showError('更新表面失败: ' + error.message);
        }
    }

    clearMolecule() {
        if (this.viewer) {
            this.viewer.clear();
            this.viewer.render();
        }
        this.atoms = [];
        this.currentVolumeId1 = null;
        this.currentVolumeId2 = null;
    }

    toggleCub1() {
        this.showCub1 = !this.showCub1;
        this.updateSurfaces();
        const button = document.getElementById(`toggleCub1-${this.id}`);
        if (button) {
            button.textContent = this.showCub1 ? '隐藏 CUB1' : '显示 CUB1';
        }
    }

    toggleCub2() {
        this.showCub2 = !this.showCub2;
        this.updateSurfaces();
        const button = document.getElementById(`toggleCub2-${this.id}`);
        if (button) {
            button.textContent = this.showCub2 ? '隐藏 CUB2' : '显示 CUB2';
        }
    }

    close() {
        this.clearMolecule();
        // 移除DOM元素
        const element = document.getElementById(`group-${this.id}`);
        if (element) {
            element.remove();
        }
    }

    takeScreenshot() {
        try {
            // 获取PNG格式的截图
            let imgData = this.viewer.pngURI();
            
            // 创建下载链接
            let downloadLink = document.createElement('a');
            downloadLink.href = imgData;
            downloadLink.download = `molecule-${this.id}.png`;
            
            // 触发下载
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // 显示提示
            createToast('截图已保存');
            
        } catch (error) {
            console.error('截图失败:', error);
            showError('截图失败: ' + error.message);
        }
    }

    getConfiguration() {
        return {
            id: this.id,
            color1: this.color1,
            color2: this.color2,
            isoValue: document.getElementById(`isoValue-${this.id}`).value,
            showCub1: this.showCub1,
            showCub2: this.showCub2,
            files: this.files.map(file => ({
                name: file.name,
                content: file.content
            }))
        };
    }

    loadConfiguration(config) {
        this.color1 = config.color1;
        this.color2 = config.color2;
        this.showCub1 = config.showCub1;
        this.showCub2 = config.showCub2;

        // 更新UI
        document.getElementById(`color1-${this.id}`).value = this.color1;
        document.getElementById(`color2-${this.id}`).value = this.color2;
        document.getElementById(`isoValue-${this.id}`).value = config.isoValue;

        // 加载文件
        if (config.files && config.files.length > 0) {
            this.files = config.files;
            this.displayMolecule();
            this.updateSurfaces();
        }
    }
}