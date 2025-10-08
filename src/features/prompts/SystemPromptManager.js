// SystemPromptManager - Manage system prompts
const DEFAULT_PROMPTS = require('../../constants/defaultPrompts');

class SystemPromptManager {
    constructor(storageService) {
        this.storageService = storageService;
        this.prompts = { ...DEFAULT_PROMPTS };
        this.loadFromStorage();
    }

    /**
     * Load system prompts from storage
     */
    loadFromStorage() {
        const saved = this.storageService.getSystemPrompts();
        if (saved) {
            this.prompts = { ...DEFAULT_PROMPTS, ...saved };
        }
    }

    /**
     * Save system prompts to storage
     */
    saveToStorage() {
        this.storageService.setSystemPrompts(this.prompts);
    }

    /**
     * Get all system prompts
     * @returns {object} All prompts
     */
    getAll() {
        return { ...this.prompts };
    }

    /**
     * Get a specific system prompt by category
     * @param {string} category - Category name
     * @returns {string} System prompt content
     */
    get(category) {
        return this.prompts[category] || this.prompts.other;
    }

    /**
     * Set a system prompt for a category
     * @param {string} category - Category name
     * @param {string} content - Prompt content
     */
    set(category, content) {
        this.prompts[category] = content;
        this.saveToStorage();
    }

    /**
     * Delete a custom system prompt
     * @param {string} category - Category name
     * @returns {boolean} True if deleted
     */
    delete(category) {
        // Don't allow deletion of default prompts
        const defaultCategories = Object.keys(DEFAULT_PROMPTS);
        if (defaultCategories.includes(category)) {
            return false;
        }
        
        delete this.prompts[category];
        this.saveToStorage();
        return true;
    }

    /**
     * Get all category names
     * @returns {Array} Category names
     */
    getCategories() {
        return Object.keys(this.prompts);
    }

    /**
     * Check if a category is a default category
     * @param {string} category - Category name
     * @returns {boolean} True if default
     */
    isDefault(category) {
        return Object.keys(DEFAULT_PROMPTS).includes(category);
    }
}

module.exports = SystemPromptManager;

