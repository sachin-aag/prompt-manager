// StorageService - Handle localStorage and IPC operations
const { ipcRenderer } = require('electron');
const CONFIG = require('../constants/config');

class StorageService {
    constructor() {
        this.KEYS = CONFIG.STORAGE_KEYS;
    }

    // API Keys
    getApiKey(provider = 'openrouter') {
        const keyMap = {
            openrouter: this.KEYS.OPENROUTER_API_KEY,
            tavily: this.KEYS.TAVILY_API_KEY,
            perplexity: this.KEYS.PERPLEXITY_API_KEY,
            brave: this.KEYS.BRAVE_API_KEY,
            exa: this.KEYS.EXA_API_KEY
        };
        return localStorage.getItem(keyMap[provider]) || '';
    }

    setApiKey(provider, apiKey) {
        const keyMap = {
            openrouter: this.KEYS.OPENROUTER_API_KEY,
            tavily: this.KEYS.TAVILY_API_KEY,
            perplexity: this.KEYS.PERPLEXITY_API_KEY,
            brave: this.KEYS.BRAVE_API_KEY,
            exa: this.KEYS.EXA_API_KEY
        };
        localStorage.setItem(keyMap[provider], apiKey);
    }

    // System Prompts
    getSystemPrompts() {
        const saved = localStorage.getItem(this.KEYS.SYSTEM_PROMPTS);
        return saved ? JSON.parse(saved) : null;
    }

    setSystemPrompts(prompts) {
        localStorage.setItem(this.KEYS.SYSTEM_PROMPTS, JSON.stringify(prompts));
    }

    // File operations via IPC
    async savePrompts(prompts) {
        try {
            const result = await ipcRenderer.invoke('save-prompts', prompts);
            return result;
        } catch (error) {
            console.error('Error saving prompts:', error);
            return { success: false, error: error.message };
        }
    }

    async loadPrompts() {
        try {
            const result = await ipcRenderer.invoke('load-prompts');
            return result;
        } catch (error) {
            console.error('Error loading prompts:', error);
            return { success: false, error: error.message };
        }
    }

    async exportPrompts(prompts) {
        try {
            const result = await ipcRenderer.invoke('export-prompts', prompts);
            return result;
        } catch (error) {
            console.error('Error exporting prompts:', error);
            return { success: false, error: error.message };
        }
    }

    async importPrompts() {
        try {
            const result = await ipcRenderer.invoke('import-prompts');
            return result;
        } catch (error) {
            console.error('Error importing prompts:', error);
            return { success: false, error: error.message };
        }
    }

    // User Prompts
    async saveUserPrompts(prompts) {
        try {
            const result = await ipcRenderer.invoke('save-user-prompts', prompts);
            return result;
        } catch (error) {
            console.error('Error saving user prompts:', error);
            return { success: false, error: error.message };
        }
    }

    async loadUserPrompts() {
        try {
            const result = await ipcRenderer.invoke('load-user-prompts');
            return result;
        } catch (error) {
            console.error('Error loading user prompts:', error);
            return { success: false, error: error.message };
        }
    }

    // Prompt Sessions
    async savePromptSession(sessionData) {
        try {
            const result = await ipcRenderer.invoke('save-prompt-session', sessionData);
            return result;
        } catch (error) {
            console.error('Error saving prompt session:', error);
            return { success: false, error: error.message };
        }
    }

    async loadPromptSessions() {
        try {
            const result = await ipcRenderer.invoke('load-prompt-sessions');
            return result;
        } catch (error) {
            console.error('Error loading prompt sessions:', error);
            return { success: false, error: error.message };
        }
    }

    async deletePromptSession(sessionId) {
        try {
            const result = await ipcRenderer.invoke('delete-prompt-session', sessionId);
            return result;
        } catch (error) {
            console.error('Error deleting prompt session:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = StorageService;

