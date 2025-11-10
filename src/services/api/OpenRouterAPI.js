// OpenRouterAPI - Handle OpenRouter API calls
const axios = require('axios');
const CONFIG = require('../../constants/config');
const { estimateTokens } = require('../../utils/formatting');

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
                top_provider: model.top_provider,
                supportsVision: model.architecture?.input_modalities?.includes('image') || false
            }));
        } catch (error) {
            console.error('Error fetching models:', error);
            throw error;
        }
    }

    /**
     * Send a chat completion request with automatic retry on timeout
     * @param {string} modelId - Model ID
     * @param {Array} messages - Array of message objects {role, content} or {role, content: [{type, text/image_url}]}
     * @param {object} options - Additional options (temperature, max_tokens, images, etc.)
     * @returns {Promise<object>} Response with content, generationId, and usage
     */
    async sendMessage(modelId, messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        const maxRetries = CONFIG.MAX_RETRIES || 2;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                    console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
                    await this._sleep(delay);
                }

                console.log(`Calling OpenRouter: ${modelId} (attempt ${attempt + 1}/${maxRetries + 1})`);
                
                // Transform messages to support multimodal content if images are provided
                const transformedMessages = this._transformMessagesWithImages(messages, options.images);
                
                const payload = {
                    model: modelId,
                    messages: transformedMessages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.max_tokens || 8000,
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
                
                console.log(`✓ OpenRouter request succeeded (${latency}ms)`);
                
                return {
                    content,
                    generationId,
                    usage,
                    latency,
                    finishReason: response.data.choices[0].finish_reason
                };
            } catch (error) {
                lastError = error;
                
                // Check if we should retry
                const isTimeout = error.code === 'ECONNABORTED';
                const isNetworkError = error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
                const is5xxError = error.response?.status >= 500 && error.response?.status < 600;
                const shouldRetry = (isTimeout || isNetworkError || is5xxError) && attempt < maxRetries;
                
                if (shouldRetry) {
                    console.warn(`Request failed (${error.code || error.message}), will retry...`);
                    continue;
                }
                
                // No more retries, throw the error
                console.error(`Error calling OpenRouter (final):`, error);
                break;
            }
        }

        // All retries failed, format and throw the error
        let errorMessage = 'Unknown error occurred';
        if (lastError.code === 'ECONNABORTED') {
            errorMessage = `Request timeout - The model took too long to respond (>${this.timeout/1000}s). Try: 1) Using a faster model, 2) Reducing max tokens, 3) Checking your internet connection`;
        } else if (lastError.response?.status === 429) {
            errorMessage = 'Rate limit exceeded - Please wait a moment and try again';
        } else if (lastError.response?.status === 503) {
            errorMessage = 'Service temporarily unavailable - The model may be overloaded, try again in a moment';
        } else if (lastError.response?.data?.error?.message) {
            errorMessage = lastError.response.data.error.message;
        } else if (lastError.message) {
            errorMessage = lastError.message;
        }
        
        throw new Error(errorMessage);
    }

    /**
     * Sleep utility for retry delays
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise}
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Transform messages to include images in multimodal format
     * @param {Array} messages - Original messages
     * @param {Array} images - Array of image data URLs (optional)
     * @returns {Array} Transformed messages
     * @private
     */
    _transformMessagesWithImages(messages, images) {
        if (!images || images.length === 0) {
            return messages;
        }

        // Transform messages to multimodal format
        return messages.map((message, index) => {
            // Only add images to the last user message
            if (message.role === 'user' && index === messages.length - 1) {
                const contentArray = [
                    {
                        type: 'text',
                        text: message.content
                    }
                ];

                // Add all images
                images.forEach(imageUrl => {
                    contentArray.push({
                        type: 'image_url',
                        image_url: {
                            url: imageUrl
                        }
                    });
                });

                return {
                    role: message.role,
                    content: contentArray
                };
            }

            return message;
        });
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

