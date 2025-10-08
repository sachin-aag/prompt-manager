// SettingsManager - Manage application settings
class SettingsManager {
    constructor(storageService, openRouterAPI, ollamaAPI) {
        this.storageService = storageService;
        this.openRouterAPI = openRouterAPI;
        this.ollamaAPI = ollamaAPI;
        this.availableModels = [];
        this.ollamaModels = [];
    }

    /**
     * Load API keys from storage
     * @returns {object} All API keys
     */
    loadApiKeys() {
        return {
            openrouter: this.storageService.getApiKey('openrouter'),
            tavily: this.storageService.getApiKey('tavily'),
            perplexity: this.storageService.getApiKey('perplexity'),
            brave: this.storageService.getApiKey('brave'),
            exa: this.storageService.getApiKey('exa')
        };
    }

    /**
     * Save API key
     * @param {string} provider - Provider name
     * @param {string} apiKey - API key
     */
    saveApiKey(provider, apiKey) {
        this.storageService.setApiKey(provider, apiKey);
        
        // Update the API service with the new key
        if (provider === 'openrouter') {
            this.openRouterAPI.setApiKey(apiKey);
        }
    }

    /**
     * Load available models from OpenRouter
     * @returns {Promise<Array>} Available models
     */
    async loadAvailableModels() {
        try {
            this.availableModels = await this.openRouterAPI.fetchModels();
            return this.availableModels;
        } catch (error) {
            console.error('Error loading models:', error);
            return [];
        }
    }

    /**
     * Load available Ollama models
     * @returns {Promise<Array>} Ollama models
     */
    async loadOllamaModels() {
        try {
            this.ollamaModels = await this.ollamaAPI.fetchModels();
            return this.ollamaModels;
        } catch (error) {
            console.error('Error loading Ollama models:', error);
            return [];
        }
    }

    /**
     * Get all available models
     * @returns {Array} All models
     */
    getAvailableModels() {
        return [...this.availableModels];
    }

    /**
     * Get Ollama models
     * @returns {Array} Ollama models
     */
    getOllamaModels() {
        return [...this.ollamaModels];
    }

    /**
     * Check Ollama installation status
     * @returns {Promise<object>} Installation status
     */
    async checkOllamaInstallation() {
        return await this.ollamaAPI.checkInstallation();
    }

    /**
     * Check if Ollama server is running
     * @returns {Promise<boolean>} True if running
     */
    async checkOllamaStatus() {
        return await this.ollamaAPI.pingServer();
    }

    /**
     * Start Ollama server
     * @returns {Promise<object>} Start result
     */
    async startOllama() {
        return await this.ollamaAPI.startServer();
    }

    /**
     * Stop Ollama server
     * @returns {Promise<object>} Stop result
     */
    async stopOllama() {
        return await this.ollamaAPI.stopServer();
    }
}

module.exports = SettingsManager;

