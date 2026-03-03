// NotesManager 类 - 处理轨道组备注功能
// 重点优化：
// 1) 不再通过 cloneNode 替换 DOM 来“移除旧监听器”（会破坏引用/光标位置/性能）
// 2) localStorage 写入做 debounce，避免每次按键都同步阻塞主线程
class NotesManager {
    constructor(groupId) {
        this.groupId = groupId;
        this.notes = '';

        // 内部状态
        this._notesArea = null;
        this._saveTimer = null;

        // 绑定一次，后续 add/removeEventListener 可复用同一引用
        this._onInput = (e) => {
            this.notes = e.target.value;
            this._scheduleSave();
        };

        this._autoResize = (e) => {
            const el = (e && e.target) ? e.target : this._notesArea;
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        };
    }

    // 初始化备注区域（需要在 DOM 已创建后调用）
    initialize() {
        const notesArea = document.getElementById(`notes-${this.groupId}`);
        if (!notesArea) return;

        this._notesArea = notesArea;
        notesArea.value = this.notes;

        this.setupEventListeners();
        // 初始化时也做一次高度调整
        this._autoResize({ target: notesArea });
    }

    // 设置备注内容
    setNotes(notes) {
        this.notes = notes || '';
        const notesArea = document.getElementById(`notes-${this.groupId}`);
        if (notesArea) {
            notesArea.value = this.notes;

            // 触发一次输入逻辑：用于自动调整高度
            this._autoResize({ target: notesArea });
        }
    }

    // 获取备注内容
    getNotes() {
        return this.notes;
    }

    // 设置事件监听器（可重复调用，但不会叠加重复监听）
    setupEventListeners() {
        const notesArea = document.getElementById(`notes-${this.groupId}`);
        if (!notesArea) return;

        // 如果 DOM 节点发生变化（比如 reassignIds 后），先解绑旧节点
        if (this._notesArea && this._notesArea !== notesArea) {
            this._notesArea.removeEventListener('input', this._onInput);
            this._notesArea.removeEventListener('input', this._autoResize);
        }

        this._notesArea = notesArea;

        // 先移除再添加，避免重复绑定
        notesArea.removeEventListener('input', this._onInput);
        notesArea.removeEventListener('input', this._autoResize);

        notesArea.addEventListener('input', this._onInput);
        notesArea.addEventListener('input', this._autoResize);
    }

    _scheduleSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        // 300ms debounce：打字时不频繁写 localStorage
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this.saveToLocalStorage();
        }, 300);
    }

    // 保存到本地存储
    saveToLocalStorage() {
        try {
            const key = `orbital-viewer-notes-${this.groupId}`;
            localStorage.setItem(key, this.notes);
        } catch (e) {
            // localStorage 可能被禁用或配额不足，忽略即可
        }
    }

    // 从本地存储加载
    loadFromLocalStorage() {
        try {
            const key = `orbital-viewer-notes-${this.groupId}`;
            const savedNotes = localStorage.getItem(key);
            if (savedNotes != null) {
                this.setNotes(savedNotes);
            }
        } catch (e) {
            // ignore
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
            const notesContent = (typeof config === 'string') ? config : config.notes;
            this.setNotes(notesContent);
        }
    }

    // 轨道组 ID 发生变化时（例如删除组后重新编号），需要同步 DOM id & storage key
    updateGroupId(newGroupId) {
        if (this.groupId === newGroupId) return;

        // 迁移 localStorage key（可选：保留用户之前的备注）
        try {
            const oldKey = `orbital-viewer-notes-${this.groupId}`;
            const newKey = `orbital-viewer-notes-${newGroupId}`;
            const existing = localStorage.getItem(oldKey);
            if (existing != null && localStorage.getItem(newKey) == null) {
                localStorage.setItem(newKey, existing);
                localStorage.removeItem(oldKey);
            }
        } catch (e) {
            // ignore
        }

        // 解绑旧监听器
        if (this._notesArea) {
            this._notesArea.removeEventListener('input', this._onInput);
            this._notesArea.removeEventListener('input', this._autoResize);
            this._notesArea = null;
        }

        this.groupId = newGroupId;
        // 重新绑定到新 ID 的 textarea
        this.initialize();
    }
}
