// ChatManager - Handle chat functionality
const { formatCost } = require('../../utils/formatting');

class ChatManager {
    constructor(openRouterAPI, ollamaAPI, tavilyAPI, storageService) {
        this.openRouterAPI = openRouterAPI;
        this.ollamaAPI = ollamaAPI;
        this.tavilyAPI = tavilyAPI;
        this.storageService = storageService;
        
        this.messages = [];
        this.selectedModel = null;
        this.provider = 'openrouter'; // 'openrouter' or 'ollama'
        this.internetProvider = 'none'; // 'none', 'tavily', 'openrouter'
        this.systemPromptCategory = 'writing';
    }

    setSelectedModel(model) {
        this.selectedModel = model;
    }

    setProvider(provider) {
        this.provider = provider;
    }

    setInternetProvider(provider) {
        this.internetProvider = provider;
    }

    setSystemPromptCategory(category) {
        this.systemPromptCategory = category;
    }

    /**
     * Send a chat message
     * @param {string} message - User message
     * @param {string} systemPrompt - System prompt
     * @returns {Promise<object>} Response with content and cost
     */
    async sendMessage(message, systemPrompt) {
        if (!message || !this.selectedModel) {
            throw new Error('Message and model required');
        }

        let modelId = this.selectedModel.id;
        let finalMessage = message;
        
        // Fetch internet context if using Tavily
        if (this.internetProvider === 'tavily') {
            const context = await this.fetchTavilyContext(message);
            if (context) {
                finalMessage = message + context;
            }
        }
        
        // Handle OpenRouter web search
        if (this.provider === 'openrouter' && this.internetProvider === 'openrouter') {
            modelId = this.selectedModel.id + ':online';
            finalMessage = message; // Don't add Tavily context
        }
        
        // Call the appropriate API based on provider
        let response;
        if (this.provider === 'ollama') {
            response = await this.ollamaAPI.sendMessage(this.selectedModel.id, systemPrompt, finalMessage);
        } else {
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: finalMessage }
            ];
            const result = await this.openRouterAPI.sendMessage(modelId, messages);
            response = {
                content: result.content,
                usage: result.usage
            };
        }
        
        // Store message
        this.messages.push({
            user: message,
            assistant: response.content,
            model: this.selectedModel.name,
            cost: response.usage,
            timestamp: new Date().toISOString()
        });
        
        return response;
    }

    /**
     * Fetch internet context using Tavily
     * @param {string} query - Search query
     * @returns {Promise<string>} Formatted context
     */
    async fetchTavilyContext(query) {
        try {
            const context = await this.tavilyAPI.getContext(query);
            return context;
        } catch (error) {
            console.error('Error fetching Tavily context:', error);
            return '';
        }
    }

    /**
     * Clear chat history
     */
    clearHistory() {
        this.messages = [];
    }

    /**
     * Get chat history
     * @returns {Array} Chat messages
     */
    getHistory() {
        return this.messages;
    }
}

module.exports = ChatManager;

