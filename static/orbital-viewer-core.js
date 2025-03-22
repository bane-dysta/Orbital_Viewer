// 存储所有查看器的数据
const viewerGroups = [];

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

// 修改 captureAllViewers 函数中的备注渲染部分
async function captureAllViewers() {
    const screenshotManager = new ScreenshotManager();
    await screenshotManager.captureAllViewers();
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
    console.log('DOMContentLoaded 事件触发');
    console.log('ORBITAL_VIEWER_CONFIG 状态:', window.ORBITAL_VIEWER_CONFIG);
    
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
        if (window.ORBITAL_VIEWER_CONFIG) {
            console.log('ORBITAL_VIEWER_CONFIG 存在但 configData 缺失');
            console.log('ORBITAL_VIEWER_CONFIG 包含:', Object.keys(window.ORBITAL_VIEWER_CONFIG));
        } else {
            console.log('ORBITAL_VIEWER_CONFIG 完全不存在');
        }
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