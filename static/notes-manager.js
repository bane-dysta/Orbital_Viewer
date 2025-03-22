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