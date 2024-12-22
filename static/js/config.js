import { defaultSettings } from './constants.js';

// 保存配置
export function saveConfiguration(viewerGroups) {
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

// 加载配置
export async function loadConfiguration(file, onConfigLoaded) {
    try {
        const text = await file.text();
        const config = JSON.parse(text);

        // 设置全局标题
        if (config.globalTitle) {
            document.getElementById('global-title').value = config.globalTitle;
            document.title = config.globalTitle;
        }

        // 返回配置数据
        return {
            globalTitle: config.globalTitle,
            viewers: config.viewers.map(viewerConfig => ({
                ...viewerConfig,
                color1: viewerConfig.color1 || defaultSettings.color1,
                color2: viewerConfig.color2 || defaultSettings.color2,
                isoValue: viewerConfig.isoValue || defaultSettings.isoValue,
                surfaceScale: viewerConfig.surfaceScale || defaultSettings.surfaceScale,
                showPositive: viewerConfig.showPositive ?? defaultSettings.showPositive
            }))
        };
    } catch (error) {
        console.error('加载配置文件失败:', error);
        throw new Error('加载配置文件失败: ' + error.message);
    }
}

// 获取配置
export function getConfiguration(viewerGroup) {
    return {
        id: viewerGroup.id,
        title: viewerGroup.title,
        color1: viewerGroup.color1,
        color2: viewerGroup.color2,
        isoValue: document.getElementById(`isoValue-${viewerGroup.id}`).value,
        surfaceScale: document.getElementById(`surfaceScale-${viewerGroup.id}`).value,
        showPositive: viewerGroup.showPositive,
        fileName1: viewerGroup.fileName1,
        fileName2: viewerGroup.fileName2
    };
}

// 应用配置
export function applyConfiguration(viewerGroup, config) {
    viewerGroup.title = config.title;
    viewerGroup.color1 = config.color1;
    viewerGroup.color2 = config.color2;
    viewerGroup.showPositive = config.showPositive;
    viewerGroup.fileName1 = config.fileName1;
    viewerGroup.fileName2 = config.fileName2 || '';
    viewerGroup.showCub1 = true;
    viewerGroup.showCub2 = true;

    // 更新UI元素
    document.getElementById(`title-${viewerGroup.id}`).value = config.title;
    document.getElementById(`color1-${viewerGroup.id}`).value = config.color1;
    document.getElementById(`color2-${viewerGroup.id}`).value = config.color2;
    document.getElementById(`isoValue-${viewerGroup.id}`).value = config.isoValue;
    document.getElementById(`surfaceScale-${viewerGroup.id}`).value = config.surfaceScale;
    document.getElementById(`scaleDisplay-${viewerGroup.id}`).textContent = config.surfaceScale;

    // 更新文件名显示
    document.getElementById(`file1-label-${viewerGroup.id}`).textContent = `文件 1: ${viewerGroup.fileName1}`;
    document.getElementById(`file2-label-${viewerGroup.id}`).textContent = `文件 2: ${viewerGroup.fileName2 || ''}`;

    // 如果至少有一个文件名，就开始加载
    if (viewerGroup.fileName1) {
        setTimeout(() => viewerGroup.autoLoadFiles(), 0);
    }
}
