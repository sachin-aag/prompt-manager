// PromptSessionManager - Manage prompt sessions (history)
class PromptSessionManager {
    constructor(storageService) {
        this.storageService = storageService;
        this.sessions = [];
    }

    /**
     * Load all sessions
     */
    async load() {
        const result = await this.storageService.loadPromptSessions();
        if (result.success) {
            this.sessions = result.data || [];
        }
        return this.sessions;
    }

    /**
     * Get all sessions
     * @returns {Array} All sessions
     */
    getAll() {
        return [...this.sessions].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    /**
     * Get a specific session by ID
     * @param {string} id - Session ID
     * @returns {object|null} Session or null
     */
    get(id) {
        return this.sessions.find(s => s.id === id) || null;
    }

    /**
     * Create a new session
     * @param {string} systemPrompt - System prompt used
     * @param {string} userPrompt - User prompt
     * @param {Array} responses - Model responses
     * @returns {object} Created session
     */
    async create(systemPrompt, userPrompt, responses) {
        const session = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            systemPrompt,
            userPrompt,
            responses,
            models: responses.map(r => r.model)
        };
        
        await this.storageService.savePromptSession(session);
        this.sessions.push(session);
        return session;
    }

    /**
     * Delete a session
     * @param {string} id - Session ID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        const result = await this.storageService.deletePromptSession(id);
        if (result.success) {
            this.sessions = this.sessions.filter(s => s.id !== id);
            return true;
        }
        return false;
    }

    /**
     * Search sessions
     * @param {string} searchTerm - Search term
     * @returns {Array} Matching sessions
     */
    search(searchTerm) {
        const term = searchTerm.toLowerCase();
        return this.sessions.filter(session => {
            const userPromptMatch = session.userPrompt.toLowerCase().includes(term);
            const modelsMatch = session.models.some(m => m.toLowerCase().includes(term));
            const responsesMatch = session.responses.some(r => 
                r.content.toLowerCase().includes(term)
            );
            return userPromptMatch || modelsMatch || responsesMatch;
        });
    }
}

module.exports = PromptSessionManager;

