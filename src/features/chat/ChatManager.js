// ChatManager - Handle chat functionality
const { formatCost } = require('../../utils/formatting');

class ChatManager {
    constructor(openRouterAPI, ollamaAPI, tavilyAPI, storageService, providers = {}) {
        this.openRouterAPI = openRouterAPI;
        this.ollamaAPI = ollamaAPI;
        this.tavilyAPI = tavilyAPI;
        this.storageService = storageService;
        this.perplexityAPI = providers.perplexityAPI;
        this.braveAPI = providers.braveAPI;
        this.exaAPI = providers.exaAPI;
        
        this.messages = [];
        this.selectedModel = null;
        this.provider = 'openrouter'; // 'openrouter' or 'ollama'
        this.internetProvider = 'none'; // 'none', 'tavily', 'openrouter'
        this.systemPromptCategory = 'writing';
        this.currentSessionId = null; // Track current chat session for history
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
        
        // Fetch internet context for selected provider
        if (['tavily', 'perplexity', 'brave', 'exa'].includes(this.internetProvider)) {
            const context = await this.fetchInternetContext(message);
            if (context) finalMessage = message + context;
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
        let generationId = null;
        
        if (this.provider === 'ollama') {
            response = await this.ollamaAPI.sendChatMessage(
                this.selectedModel.id, 
                messages,
                { images }
            );
        } else {
            const result = await this.openRouterAPI.sendMessage(modelId, messages, { images });
            generationId = result.generationId;
            response = {
                content: result.content,
                usage: result.usage,
                generationId: generationId
            };
        }
        
        // Store message with initial usage data
        const messageEntry = {
            user: message,
            assistant: response.content,
            model: this.selectedModel.name,
            cost: response.usage,
            timestamp: new Date().toISOString(),
            hasImages: images.length > 0,
            generationId: generationId
        };
        this.messages.push(messageEntry);
        
        // Fetch detailed cost data for OpenRouter after a delay
        if (generationId && this.provider === 'openrouter') {
            setTimeout(async () => {
                try {
                    const costData = await this.openRouterAPI.fetchCostData(generationId);
                    // Update the message cost with detailed data
                    messageEntry.cost = costData;
                } catch (error) {
                    console.error('Error fetching cost data for chat message:', error);
                }
            }, 10000); // 10 second delay to allow cost data to be available
        }
        
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
    async fetchInternetContext(query) {
        try {
            if (this.internetProvider === 'tavily' && this.tavilyAPI) {
                return await this.tavilyAPI.getContext(query);
            }
            if (this.internetProvider === 'perplexity' && this.perplexityAPI) {
                return await this.perplexityAPI.getContext(query);
            }
            if (this.internetProvider === 'brave' && this.braveAPI) {
                return await this.braveAPI.getContext(query);
            }
            if (this.internetProvider === 'exa' && this.exaAPI) {
                return await this.exaAPI.getContext(query);
            }
            return '';
        } catch (error) {
            console.error('Error fetching internet context:', error);
            return '';
        }
    }

    /**
     * Clear chat history
     */
    clearHistory() {
        this.messages = [];
        this.currentSessionId = null; // Reset session when clearing chat
    }

    /**
     * Get chat history
     * @returns {Array} Chat messages
     */
    getHistory() {
        return this.messages;
    }

    /**
     * Get current session ID
     * @returns {string|null} Current session ID
     */
    getCurrentSessionId() {
        return this.currentSessionId;
    }

    /**
     * Set current session ID
     * @param {string} sessionId - Session ID
     */
    setCurrentSessionId(sessionId) {
        this.currentSessionId = sessionId;
    }
}

module.exports = ChatManager;

