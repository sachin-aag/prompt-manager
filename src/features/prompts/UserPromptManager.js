// UserPromptManager - Manage user prompts
class UserPromptManager {
    constructor(storageService) {
        this.storageService = storageService;
        this.prompts = [];
    }

    /**
     * Load user prompts
     */
    async load() {
        const result = await this.storageService.loadUserPrompts();
        if (result.success) {
            this.prompts = result.data || [];
        }
        return this.prompts;
    }

    /**
     * Save user prompts
     */
    async save() {
        await this.storageService.saveUserPrompts(this.prompts);
    }

    /**
     * Get all user prompts
     * @returns {Array} All prompts
     */
    getAll() {
        return [...this.prompts];
    }

    /**
     * Get a specific prompt by ID
     * @param {string} id - Prompt ID
     * @returns {object|null} Prompt or null
     */
    get(id) {
        return this.prompts.find(p => p.id === id) || null;
    }

    /**
     * Create a new user prompt
     * @param {string} title - Prompt title
     * @param {string} content - Prompt content
     * @param {string} category - Category
     * @returns {object} Created prompt
     */
    async create(title, content, category = 'other') {
        const prompt = {
            id: Date.now().toString(),
            title,
            content,
            category,
            createdAt: new Date().toISOString()
        };
        
        this.prompts.push(prompt);
        await this.save();
        return prompt;
    }

    /**
     * Update an existing prompt
     * @param {string} id - Prompt ID
     * @param {object} updates - Updates to apply
     * @returns {boolean} True if updated
     */
    async update(id, updates) {
        const index = this.prompts.findIndex(p => p.id === id);
        if (index === -1) return false;
        
        this.prompts[index] = {
            ...this.prompts[index],
            ...updates
        };
        
        await this.save();
        return true;
    }

    /**
     * Delete a prompt
     * @param {string} id - Prompt ID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        const initialLength = this.prompts.length;
        this.prompts = this.prompts.filter(p => p.id !== id);
        
        if (this.prompts.length < initialLength) {
            await this.save();
            return true;
        }
        
        return false;
    }

    /**
     * Check if a prompt with this content already exists
     * @param {string} content - Prompt content
     * @returns {boolean} True if exists
     */
    exists(content) {
        return this.prompts.some(p => p.content === content);
    }
}

module.exports = UserPromptManager;

