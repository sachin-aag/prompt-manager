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
     * @param {Array} images - Array of image data URLs (optional)
     * @returns {Promise<object>} Response with content and cost
     */
    async sendMessage(message, systemPrompt, images = []) {
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
        
        // Build messages array with chat history for context
        const messages = this._buildMessagesWithContext(systemPrompt, finalMessage);
        
        // Call the appropriate API based on provider
        let response;
        if (this.provider === 'ollama') {
            response = await this.ollamaAPI.sendChatMessage(
                this.selectedModel.id, 
                messages,
                { images }
            );
        } else {
            const result = await this.openRouterAPI.sendMessage(modelId, messages, { images });
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
            timestamp: new Date().toISOString(),
            hasImages: images.length > 0
        });
        
        return response;
    }

    /**
     * Build messages array including chat history for context
     * @param {string} systemPrompt - System prompt
     * @param {string} currentMessage - Current user message
     * @returns {Array} Messages array with context
     * @private
     */
    _buildMessagesWithContext(systemPrompt, currentMessage) {
        const messages = [];
        
        // Add system prompt
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        
        // Add chat history
        for (const msg of this.messages) {
            messages.push({ role: 'user', content: msg.user });
            messages.push({ role: 'assistant', content: msg.assistant });
        }
        
        // Add current message
        messages.push({ role: 'user', content: currentMessage });
        
        return messages;
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

