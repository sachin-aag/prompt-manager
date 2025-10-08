// OpenRouterAPI - Handle OpenRouter API calls
const axios = require('axios');
const CONFIG = require('../constants/config');
const { estimateTokens } = require('../utils/formatting');

class OpenRouterAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = CONFIG.OPENROUTER_BASE_URL;
        this.timeout = CONFIG.DEFAULT_TIMEOUT;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Fetch available models from OpenRouter
     * @returns {Promise<Array>} Array of available models
     */
    async fetchModels() {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        try {
            console.log('Loading models from OpenRouter...');
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            const models = response.data.data || [];
            console.log(`Loaded ${models.length} models from OpenRouter`);
            
            // Transform models to ensure consistent format
            return models.map(model => ({
                id: model.id,
                name: model.name || model.id,
                description: model.description,
                context_length: model.context_length,
                pricing: model.pricing,
                top_provider: model.top_provider
            }));
        } catch (error) {
            console.error('Error fetching models:', error);
            throw error;
        }
    }

    /**
     * Send a chat completion request
     * @param {string} modelId - Model ID
     * @param {Array} messages - Array of message objects {role, content}
     * @param {object} options - Additional options (temperature, max_tokens, etc.)
     * @returns {Promise<object>} Response with content, generationId, and usage
     */
    async sendMessage(modelId, messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        try {
            console.log(`Calling OpenRouter: ${modelId}`);
            
            const payload = {
                model: modelId,
                messages: messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 1000,
                stream: false
            };
            
            const startTime = Date.now();
            const response = await axios.post(`${this.baseURL}/chat/completions`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            const endTime = Date.now();
            const latency = endTime - startTime;
            
            const content = response.data.choices[0].message.content;
            const generationId = response.data.id;
            
            // Extract usage data if available
            let usage = null;
            if (response.data.usage) {
                usage = {
                    inputTokens: response.data.usage.prompt_tokens || 0,
                    outputTokens: response.data.usage.completion_tokens || 0,
                    totalTokens: response.data.usage.total_tokens || 0
                };
            }
            
            return {
                content,
                generationId,
                usage,
                latency,
                finishReason: response.data.choices[0].finish_reason
            };
        } catch (error) {
            console.error(`Error calling OpenRouter:`, error);
            
            let errorMessage = 'Unknown error occurred';
            if (error.code === 'ECONNABORTED') {
                errorMessage = 'Request timeout - the model took too long to respond';
            } else if (error.response?.data?.error?.message) {
                errorMessage = error.response.data.error.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            throw new Error(errorMessage);
        }
    }

    /**
     * Fetch cost data for a generation
     * @param {string} generationId - Generation ID from API response
     * @returns {Promise<object>} Cost and usage data
     */
    async fetchCostData(generationId) {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        try {
            console.log(`Fetching cost data for generation: ${generationId}`);
            const response = await axios.get(`${this.baseURL}/generation?id=${generationId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            const data = response.data.data;
            if (!data) {
                throw new Error('No generation data returned');
            }

            return {
                inputTokens: data.tokens_prompt || data.usage?.prompt_tokens || 0,
                outputTokens: data.tokens_completion || data.usage?.completion_tokens || 0,
                totalTokens: (data.tokens_prompt || 0) + (data.tokens_completion || 0),
                totalCost: data.total_cost || 0,
                inputCost: data.native_tokens_prompt * (data.model_pricing?.prompt || 0),
                outputCost: data.native_tokens_completion * (data.model_pricing?.completion || 0),
                latency: data.latency,
                finishReason: data.finish_reason
            };
        } catch (error) {
            console.error('Error fetching cost data:', error);
            throw error;
        }
    }
}

module.exports = OpenRouterAPI;

