// 存储所有查看器的数据
const viewerGroups = [];
// 兼容 inline onclick（某些环境下 top-level const 不一定暴露为 window 属性）
window.viewerGroups = viewerGroups;

const DEBUG_ORB_VIEWER = Boolean(window.DEBUG_ORB_VIEWER);
function debugLog(...args) {
    if (DEBUG_ORB_VIEWER) console.log(...args);
}

// 同步所有查看器视角
function syncAllViews() {
    if (viewerGroups.length <= 1) return;

    // 使用第一个查看器的视角作为参考
    const state = viewerGroups[0].getViewState();
    if (!state) return;

    // 将视角同步到其他所有查看器
    viewerGroups.forEach((group, index) => {
        if (index > 0) {
            group.setViewState(state, viewerGroups[0].id);
        }
    });
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

// 保存当前配置
function saveConfiguration() {
    const globalTitleEl = document.getElementById('global-title');
    const config = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        globalTitle: globalTitleEl ? globalTitleEl.value : '',
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

// 全局导出截图（复制到剪贴板）
async function captureAllViewers() {
    const screenshotManager = new ScreenshotManager();
    await screenshotManager.captureAllViewers();
}

// （可选）加载配置文件（如果你在页面里放了 <input type="file" onchange="loadConfiguration(event)">）
async function loadConfiguration(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const config = JSON.parse(text);

        if (config.globalTitle) {
            const globalTitleEl = document.getElementById('global-title');
            if (globalTitleEl) globalTitleEl.value = config.globalTitle;
            document.title = config.globalTitle;
        }

        // 清除现有查看器组
        const container = document.getElementById('viewers-container');
        if (container) container.innerHTML = '';
        viewerGroups.length = 0;

        // 创建新的查看器组
        for (const viewerConfig of (config.viewers || [])) {
            const newGroup = new ViewerGroup(viewerConfig.id);
            viewerGroups.push(newGroup);

            // 添加HTML结构
            const container = document.getElementById('viewers-container');
            container.insertAdjacentHTML('beforeend', newGroup.createHTML());

            // 初始化查看器并加载配置
            newGroup.initialize();
            newGroup.loadConfiguration(viewerConfig);
        }
    } catch (error) {
        console.error('加载配置文件失败:', error);
        alert('加载配置文件失败: ' + error.message);
    } finally {
        // 清除文件输入
        event.target.value = '';
    }
}

// 全局标题输入：同步浏览器标题
(function setupGlobalTitleListener() {
    const globalTitleEl = document.getElementById('global-title');
    if (!globalTitleEl) return;

    globalTitleEl.addEventListener('input', function () {
        document.title = this.value || 'Orbital Viewer';
    });
})();

// DOM ready：优先使用服务端注入的 ORBITAL_VIEWER_CONFIG
document.addEventListener('DOMContentLoaded', function () {
    const injected = window.ORBITAL_VIEWER_CONFIG && window.ORBITAL_VIEWER_CONFIG.configData
        ? window.ORBITAL_VIEWER_CONFIG.configData
        : null;

    if (injected) {
        debugLog('Using injected ORBITAL_VIEWER_CONFIG');

        // 设置全局标题
        if (injected.globalTitle) {
            const globalTitleEl = document.getElementById('global-title');
            if (globalTitleEl) globalTitleEl.value = injected.globalTitle;
            document.title = injected.globalTitle;
        }

        // 清除现有查看器组
        const container = document.getElementById('viewers-container');
        if (container) container.innerHTML = '';
        viewerGroups.length = 0;

        // 创建新的查看器组
        for (const viewerConfig of (injected.viewers || [])) {
            const newGroup = new ViewerGroup(viewerConfig.id);
            viewerGroups.push(newGroup);

            // 添加HTML结构
            const container = document.getElementById('viewers-container');
            container.insertAdjacentHTML('beforeend', newGroup.createHTML());

            newGroup.initialize();
            newGroup.loadConfiguration(viewerConfig);
        }

        if (viewerGroups.length === 0) {
            addNewViewerGroup();
        }
    } else {
        addNewViewerGroup();
    }
});

// 调试用：检查 DOM 与 viewerGroups 是否一致
function validateViewerGroupsState() {
    if (!DEBUG_ORB_VIEWER) return;

    const domGroups = document.querySelectorAll('.viewer-group');

    // 检查 DOM 和数组长度是否匹配
    if (domGroups.length !== viewerGroups.length) {
        console.error('DOM 和 viewerGroups 数组长度不匹配');
        console.log(`DOM: ${domGroups.length}, Array: ${viewerGroups.length}`);
    }

    // 检查每个元素的 ID 是否正确
    domGroups.forEach((element, index) => {
        const domId = parseInt(element.id.replace('group-', ''), 10);
        const arrayId = viewerGroups[index].id;

        if (domId !== arrayId) {
            console.error(`ID 不匹配 - DOM: ${domId}, Array: ${arrayId}`);
        }
    });
}
