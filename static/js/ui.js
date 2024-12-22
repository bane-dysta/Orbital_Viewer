import { DEFAULT_SETTINGS } from './constants.js';

// 创建查看器组的HTML结构
export function createViewerGroupHTML(id, title = '', color1 = DEFAULT_SETTINGS.color1, color2 = DEFAULT_SETTINGS.color2) {
    return `
        <div class="viewer-group" id="group-${id}">
            <div class="viewer-header">
                <input type="text" class="title-input" id="title-${id}" value="${title || `轨道组 ${id}`}">
                <div class="close-btn-container">
                    <button class="close-btn" onclick="viewerGroups[${id}].close()">×</button>
                </div>
            </div>
            <div class="viewer-container">
                <div class="viewer-controls">
                    <div class="tabs">
                        <button class="tab-btn active" data-tab="basic" onclick="switchTab(${id}, 'basic')">基础设置</button>
                        <button class="tab-btn" data-tab="mapping" onclick="switchTab(${id}, 'mapping')">映射设置</button>
                    </div>
                    
                    <div id="basic-tab-${id}" class="tab-content active">
                        <div class="control-group">
                            <div class="input-container">
                                <div>
                                    <label for="isoValue-${id}">等值面值:</label>
                                    <input type="number" id="isoValue-${id}" value="${DEFAULT_SETTINGS.isoValue}" step="0.001">
                                </div>
                            </div>
                        </div>
                        <div class="control-group">
                            <div class="file-info">
                                <div class="file-control">
                                    <label class="file-label" id="file1-label-${id}">文件 1:</label>
                                    <input type="color" id="color1-${id}" value="${color1}">
                                </div>
                                <div class="file-control">
                                    <label class="file-label" id="file2-label-${id}">文件 2:</label>
                                    <input type="color" id="color2-${id}" value="${color2}">
                                </div>
                            </div>
                        </div>
                        <div class="control-group">
                            <div class="button-row">
                                <button class="btn" id="toggleCub1-${id}" onclick="viewerGroups[${id}].toggleCub1()">
                                    隐藏 CUB1
                                </button>
                                <button class="btn" id="toggleCub2-${id}" onclick="viewerGroups[${id}].toggleCub2()">
                                    隐藏 CUB2
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="mapping-tab-${id}" class="tab-content">
                        <div class="control-group">
                            <div class="mapping-controls">
                                <button class="btn" id="toggleColorMap-${id}" onclick="viewerGroups[${id}].toggleColorMapping()">
                                    启用值映射
                                </button>
                            </div>
                            <div class="mapping-range">
                                <div class="range-input">
                                    <label>最小值:</label>
                                    <input type="number" id="minMapValue-${id}" 
                                           value="${DEFAULT_SETTINGS.minMapValue}" 
                                           step="0.001">
                                </div>
                                <div class="range-input">
                                    <label>最大值:</label>
                                    <input type="number" id="maxMapValue-${id}" 
                                           value="${DEFAULT_SETTINGS.maxMapValue}" 
                                           step="0.001">
                                </div>
                            </div>
                            <div class="mapping-colors">
                                <div class="color-input">
                                    <label>负值颜色:</label>
                                    <input type="color" id="negativeColor-${id}" 
                                           value="#0000FF">
                                </div>
                                <div class="color-input">
                                    <label>正值颜色:</label>
                                    <input type="color" id="positiveColor-${id}" 
                                           value="#FF0000">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="control-group">
                        <button class="btn screenshot-btn" onclick="viewerGroups[${id}].takeScreenshot()">
                            截图
                        </button>
                    </div>
                </div>
                <div class="viewer" id="viewer-${id}"></div>
            </div>
        </div>
    `;
}

// 创建拖放区域
export function createDropZone(id) {
    return `
        <div class="drop-zone" id="drop-zone-${id}">
            <div class="drop-zone-text">拖放 .cube 文件到此处</div>
            <div class="file-list"></div>
        </div>
    `;
}

// 创建文件列表项
export function createFileListItem(file) {
    return `<div class="file-item">${file.name}</div>`;
}

// 创建Toast提示
export function createToast(message) {
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

// 更新文件标签
export function updateFileLabel(id, fileNumber, fileName) {
    const label = document.getElementById(`file${fileNumber}-label-${id}`);
    if (label) {
        label.textContent = `文件 ${fileNumber}: ${fileName || ''}`;
    }
}

// 切换选项卡
export function switchTab(groupId, tabName) {
    const tabBtns = document.querySelectorAll(`#group-${groupId} .tab-btn`);
    const tabContents = document.querySelectorAll(`#group-${groupId} .tab-content`);
    
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`#group-${groupId} .tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.querySelector(`#group-${groupId} #${tabName}-tab-${groupId}`).classList.add('active');
}

// 显示错误信息
export function showError(message) {
    console.error(message);
    alert(message);
}

// 显示加载中状态
export function showLoading(id) {
    const viewer = document.getElementById(`viewer-${id}`);
    if (viewer) {
        viewer.classList.add('loading');
    }
}

// 隐藏加载中状态
export function hideLoading(id) {
    const viewer = document.getElementById(`viewer-${id}`);
    if (viewer) {
        viewer.classList.remove('loading');
    }
}

// 更新按钮状态
export function updateButtonState(id, buttonId, isActive) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.classList.toggle('active', isActive);
    }
}

// 禁用输入控件
export function disableInputs(id, inputIds) {
    inputIds.forEach(inputId => {
        const input = document.getElementById(`${inputId}-${id}`);
        if (input) {
            input.disabled = true;
        }
    });
}

// 启用输入控件
export function enableInputs(id, inputIds) {
    inputIds.forEach(inputId => {
        const input = document.getElementById(`${inputId}-${id}`);
        if (input) {
            input.disabled = false;
        }
    });
}

// 更新输入值
export function updateInputValue(id, inputId, value) {
    const input = document.getElementById(`${inputId}-${id}`);
    if (input) {
        input.value = value;
    }
}

// 获取输入值
export function getInputValue(id, inputId) {
    const input = document.getElementById(`${inputId}-${id}`);
    return input ? input.value : null;
}

// 添加事件监听器
export function addEventListeners(id, events) {
    events.forEach(({ elementId, event, handler }) => {
        const element = document.getElementById(`${elementId}-${id}`);
        if (element) {
            element.addEventListener(event, handler);
        }
    });
}

// 移除事件监听器
export function removeEventListeners(id, events) {
    events.forEach(({ elementId, event, handler }) => {
        const element = document.getElementById(`${elementId}-${id}`);
        if (element) {
            element.removeEventListener(event, handler);
        }
    });
}
