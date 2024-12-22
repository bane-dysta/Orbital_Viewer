import { ViewerGroup } from './core.js';
import { createViewerGroupHTML } from './ui.js';
import { UI_CONSTANTS } from './constants.js';

// 全局变量
window.viewerGroups = [];

// 初始化应用
function initializeApp() {
    // 添加新建组按钮的事件监听
    document.getElementById('addGroup').addEventListener('click', addViewerGroup);
    
    // 添加保存配置按钮的事件监听
    document.getElementById('saveConfig').addEventListener('click', saveConfiguration);
    
    // 添加全局截图按钮的事件监听
    document.getElementById('captureAll').addEventListener('click', captureAllViewers);
    
    // 添加加载配置按钮的事件监听
    document.getElementById('loadConfig').addEventListener('click', loadConfiguration);
}

// 添加新的查看器组
function addViewerGroup() {
    if (viewerGroups.length >= UI_CONSTANTS.maxViewerGroups) {
        alert(`最多只能创建 ${UI_CONSTANTS.maxViewerGroups} 个查看器组`);
        return;
    }

    const id = viewerGroups.length;
    const container = document.getElementById('viewer-container');
    
    // 创建新的查看器组HTML
    const groupHTML = createViewerGroupHTML(id);
    container.insertAdjacentHTML('beforeend', groupHTML);
    
    // 创建并初始化新的查看器组
    const group = new ViewerGroup(id);
    viewerGroups.push(group);
    
    // 更新布局
    updateLayout();
}

// 更新布局
function updateLayout() {
    const container = document.getElementById('viewer-container');
    const groups = container.getElementsByClassName('viewer-group');
    
    if (groups.length === 0) return;
    
    // 计算每行显示的查看器数量
    const containerWidth = container.clientWidth;
    const minWidth = 400; // 最小查看器宽度
    const columns = Math.floor(containerWidth / minWidth) || 1;
    
    // 设置网格布局
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    container.style.gap = '15px';
    
    // 调整每个查看器的大小
    Array.from(groups).forEach(group => {
        const viewer = group.querySelector('.viewer');
        if (viewer) {
            viewer.style.height = `${UI_CONSTANTS.minViewerHeight}px`;
        }
    });
}

// 保存配置
function saveConfiguration() {
    try {
        const config = {
            groups: viewerGroups.map(group => group.getConfiguration()),
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'orbital-viewer-config.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('保存配置失败:', error);
        alert('保存配置失败: ' + error.message);
    }
}

// 加载配置
function loadConfiguration() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    applyConfiguration(config);
                } catch (error) {
                    console.error('解析配置文件失败:', error);
                    alert('配置文件格式不正确');
                }
            };
            reader.readAsText(file);
            
        } catch (error) {
            console.error('加载配置失败:', error);
            alert('加载配置失败: ' + error.message);
        }
    };
    
    input.click();
}

// 应用配置
function applyConfiguration(config) {
    try {
        // 清除现有的查看器组
        viewerGroups.forEach(group => group.close());
        viewerGroups = [];
        
        // 创建新的查看器组
        config.groups.forEach(groupConfig => {
            const group = addViewerGroup();
            group.loadConfiguration(groupConfig);
        });
        
    } catch (error) {
        console.error('应用配置失败:', error);
        alert('应用配置失败: ' + error.message);
    }
}

// 截图所有查看器
function captureAllViewers() {
    try {
        viewerGroups.forEach(group => {
            group.takeScreenshot();
        });
    } catch (error) {
        console.error('截图失败:', error);
        alert('截图失败: ' + error.message);
    }
}

// 监听窗口大小变化
window.addEventListener('resize', updateLayout);

// 初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);
