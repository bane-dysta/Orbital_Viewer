// 截图处理模块
class ScreenshotManager {
    constructor() {
        this.scale = 2; // 缩放因子
        this.padding = 40 * this.scale;
        this.titleHeight = 80 * this.scale;
        this.lineHeight = 2 * this.scale;
        this.notesLineHeight = 36 * this.scale;
    }

    // 解析备注文本，提取键值对和标题
    parseNotes(notes) {
        const result = {
            title: '',
            pairs: []
        };

        if (!notes) return result;

        const lines = notes.trim().split('\n');

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // 尝试匹配键值对
            const kvMatch = line.match(/^(.+?)\s*[=:]\s*(.+)$/);
            if (kvMatch) {
                result.pairs.push({
                    key: kvMatch[1].trim(),
                    value: kvMatch[2].trim()
                });
                continue;
            }
        }

        return result;
    }

    // 绘制表格
    drawTable(ctx, parsedNotes, x, y, width) {
        const cellPadding = 20 * this.scale;  // 内边距
        const cellHeight = 60 * this.scale;   // 单元格高度
        
        // 设置字体
        ctx.font = `${36 * this.scale}px Arial`;
        ctx.textBaseline = 'middle';
        
        // 计算列宽 (减小到原来的一半)
        const tableWidth = width * 0.5;  // 整个表格宽度减半
        const colWidth = tableWidth / 2;  // 单列宽度
        const tableX = x + (width - tableWidth) / 2;  // 居中表格
        
        // 绘制表格背景
        ctx.fillStyle = '#f8f9fa';  // 浅灰色背景
        ctx.fillRect(tableX, y, tableWidth, cellHeight * parsedNotes.pairs.length);
        
        // 直接绘制数据行
        for (let pair of parsedNotes.pairs) {
            // 绘制单元格边框
            ctx.strokeStyle = '#666';  // 深一点的边框颜色
            ctx.lineWidth = 2 * this.scale;  // 加粗边框
            ctx.strokeRect(tableX, y, colWidth, cellHeight);
            ctx.strokeRect(tableX + colWidth, y, colWidth, cellHeight);
            
            // 绘制键（居中对齐）
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.fillText(pair.key, tableX + colWidth/2, y + cellHeight/2);
            
            // 绘制值（居中对齐）
            // 如果是数字，保留5位小数
            const value = isNaN(pair.value) ? pair.value : parseFloat(pair.value).toFixed(5);
            ctx.fillText(value, tableX + colWidth + colWidth/2, y + cellHeight/2);
            
            y += cellHeight;
        }
        
        return y; // 返回最终的y坐标
    }

    // 处理单个查看器的截图
    async captureViewer(element) {
        const canvas = element.querySelector('.viewer canvas');
        if (!canvas) return null;

        // 获取标题和备注
        const titleInput = element.querySelector('.title-input');
        const title = titleInput ? titleInput.value : '';
        const notesArea = element.querySelector('.notes-area');
        const notes = notesArea ? notesArea.value : '';

        // 解析备注
        const parsedNotes = this.parseNotes(notes);

        // 创建临时画布
        const tempCanvas = document.createElement('canvas');
        const tableHeight = (parsedNotes.pairs.length * 40 + (parsedNotes.title ? 50 : 0)) * this.scale;
        tempCanvas.width = canvas.width * this.scale;
        tempCanvas.height = (canvas.height + this.titleHeight + tableHeight + this.lineHeight * 3) * this.scale;
        const tempCtx = tempCanvas.getContext('2d');

        // 设置背景
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // 绘制标题
        tempCtx.fillStyle = '#333';
        tempCtx.font = `bold ${48 * this.scale}px Arial`;
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText(title, tempCanvas.width / 2, this.titleHeight / 2);

        // 绘制分隔线
        tempCtx.strokeStyle = '#ddd';
        tempCtx.lineWidth = this.lineHeight;
        tempCtx.beginPath();
        tempCtx.moveTo(0, this.titleHeight);
        tempCtx.lineTo(tempCanvas.width, this.titleHeight);
        tempCtx.stroke();

        // 绘制3D内容
        tempCtx.save();
        tempCtx.translate(0, this.titleHeight + this.lineHeight);
        tempCtx.scale(this.scale, this.scale);
        tempCtx.drawImage(canvas, 0, 0);
        tempCtx.restore();

        // 绘制表格
        const tableY = this.titleHeight + canvas.height * this.scale + this.lineHeight * 2;
        this.drawTable(tempCtx, parsedNotes, this.padding, tableY, tempCanvas.width - this.padding * 2);

        return {
            canvas: tempCanvas,
            width: tempCanvas.width,
            height: tempCanvas.height
        };
    }

    // 捕获所有查看器的截图
    async captureAllViewers() {
        const viewerElements = document.querySelectorAll('.viewer-group');
        if (viewerElements.length === 0) {
            alert('没有可用的轨道组！');
            return;
        }

        try {
            const finalCanvas = document.createElement('canvas');
            const ctx = finalCanvas.getContext('2d');

            // 获取所有有效的截图
            const screenshots = [];
            let maxWidth = 0;
            let maxHeight = 0;

            for (const element of viewerElements) {
                const screenshot = await this.captureViewer(element);
                if (screenshot) {
                    screenshots.push(screenshot);
                    maxWidth = Math.max(maxWidth, screenshot.width);
                    maxHeight = Math.max(maxHeight, screenshot.height);
                }
            }

            // 计算网格布局
            const { rows, cols } = this.calculateGridDimensions(screenshots.length);

            // 计算最终画布的大小
            const totalWidth = (maxWidth + this.padding) * cols - this.padding;
            const totalHeight = (maxHeight + this.padding) * rows - this.padding;

            // 设置最终画布的大小
            finalCanvas.width = totalWidth + this.padding * 2;
            finalCanvas.height = totalHeight + this.padding * 2;

            // 填充白色背景
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            // 在网格中绘制所有截图
            let index = 0;
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    if (index >= screenshots.length) break;
                    
                    const screenshot = screenshots[index];
                    const x = this.padding + col * (maxWidth + this.padding) + (maxWidth - screenshot.width) / 2;
                    const y = this.padding + row * (maxHeight + this.padding) + (maxHeight - screenshot.height) / 2;
                    
                    ctx.drawImage(screenshot.canvas, x, y);
                    index++;
                }
            }

            // 复制到剪贴板
            finalCanvas.toBlob(async (blob) => {
                try {
                    const item = new ClipboardItem({ "image/png": blob });
                    await navigator.clipboard.write([item]);
                    this.showToast('全局截图已复制到剪贴板');
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

    // 计算网格布局
    calculateGridDimensions(count) {
        if (count <= 0) return { rows: 0, cols: 0 };
        if (count === 1) return { rows: 1, cols: 1 };
        if (count === 2) return { rows: 1, cols: 2 };
        if (count === 3) return { rows: 2, cols: 2 };
        if (count === 4) return { rows: 2, cols: 2 };
        
        const sqrt = Math.sqrt(count);
        const cols = Math.ceil(sqrt);
        const rows = Math.ceil(count / cols);
        
        if (rows / cols < 0.5) {
            return {
                rows: Math.ceil(Math.sqrt(count)),
                cols: Math.ceil(Math.sqrt(count))
            };
        }
        
        return { rows, cols };
    }

    // 显示提示信息
    showToast(message) {
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
}

// 导出模块
window.ScreenshotManager = ScreenshotManager; 