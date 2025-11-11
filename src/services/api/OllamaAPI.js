// OllamaAPI - Handle Ollama local API calls
const axios = require('axios');
const { ipcRenderer } = require('electron');
const CONFIG = require('../../constants/config');
const { estimateTokens } = require('../../utils/formatting');

class OllamaAPI {
    constructor() {
        this.baseURL = CONFIG.OLLAMA_BASE_URL;
        this.timeout = CONFIG.OLLAMA_TIMEOUT;
    }

    /**
     * Check if Ollama is installed
     * @returns {Promise<object>} Installation status
     */
    async checkInstallation() {
        try {
            const result = await ipcRenderer.invoke('check-ollama-installation');
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Ping Ollama server to check if it's running
     * @returns {Promise<boolean>} True if server is running
     */
    async pingServer() {
        try {
            await axios.get(`${this.baseURL}/api/version`, {
                timeout: 3000
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Start Ollama server
     * @returns {Promise<object>} Start result
     */
    async startServer() {
        try {
            const result = await ipcRenderer.invoke('start-ollama');
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop Ollama server
     * @returns {Promise<object>} Stop result
     */
    async stopServer() {
        try {
            const result = await ipcRenderer.invoke('stop-ollama');
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch available local models
     * @returns {Promise<Array>} Array of local models
     */
    async fetchModels() {
        try {
            console.log('Loading Ollama models...');
            const response = await axios.get(`${this.baseURL}/api/tags`, {
                timeout: 5000
            });
            
            if (response.data && response.data.models) {
                // Fetch detailed info for each model to check families
                const modelsWithVisionInfo = await Promise.all(
                    response.data.models.map(async (model) => {
                        try {
                            // Call /api/show to get model details including families
                            const detailResponse = await axios.post(`${this.baseURL}/api/show`, {
                                name: model.name
                            }, { timeout: 3000 });
                            
                            const families = detailResponse.data.details?.families || [];
                            const visionFamilies = ['llava', 'bakllava', 'minicpm-v'];
                            const supportsVision = families.some(family => 
                                visionFamilies.includes(family.toLowerCase())
                            );
                            
                            return {
                                id: model.name,
                                name: model.name,
                                size: model.size,
                                modified_at: model.modified_at,
                                supportsVision
                            };
                        } catch (error) {
                            // If /api/show fails, fall back to name-based detection
                            console.warn(`Could not fetch details for ${model.name}, using name-based detection`);
                            const modelLower = model.name.toLowerCase();
                            const visionKeywords = ['llava', 'bakllava', 'minicpm-v', 'vision'];
                            const supportsVision = visionKeywords.some(keyword => modelLower.includes(keyword));
                            
                            return {
                                id: model.name,
                                name: model.name,
                                size: model.size,
                                modified_at: model.modified_at,
                                supportsVision
                            };
                        }
                    })
                );
                
                console.log(`Loaded ${modelsWithVisionInfo.length} Ollama models`);
                return modelsWithVisionInfo;
            }
            
            return [];
        } catch (error) {
            console.error('Error fetching Ollama models:', error);
            throw error;
        }
    }

    /**
     * Send a message to Ollama model (supports both text and vision models)
     * @param {string} modelId - Model name
     * @param {string} systemPrompt - System prompt
     * @param {string} message - User message
     * @param {object} options - Additional options (temperature, max_tokens, images)
     * @returns {Promise<object>} Response with content and cost info
     */
    async sendMessage(modelId, systemPrompt, message, options = {}) {
        try {
            // For vision models, use chat API; for text models, use generate API
            const hasImages = options.images && options.images.length > 0;
            
            if (hasImages) {
                return await this._sendVisionMessage(modelId, systemPrompt, message, options);
            } else {
                return await this._sendTextMessage(modelId, systemPrompt, message, options);
            }
        } catch (error) {
            console.error('Error calling Ollama:', error);
            throw error;
        }
    }

    /**
     * Send a chat message with full conversation history using chat API (with retry logic)
     * @param {string} modelId - Model name
     * @param {Array} messages - Array of message objects {role, content}
     * @param {object} options - Additional options (temperature, max_tokens, images)
     * @returns {Promise<object>} Response with content and cost info
     */
    async sendChatMessage(modelId, messages, options = {}) {
        const maxRetries = CONFIG.MAX_RETRIES || 2;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
                    console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
                    await this._sleep(delay);
                }

                console.log(`Calling Ollama: ${modelId} (attempt ${attempt + 1}/${maxRetries + 1})`);
                
                // Transform messages to include images in the last user message if provided
                const transformedMessages = this._transformMessagesWithImages(messages, options.images);
                
                const startTime = Date.now();
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    model: modelId,
                    messages: transformedMessages,
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.7,
                        num_predict: options.max_tokens || 8000
                    }
                }, {
                    timeout: this.timeout
                });

                const endTime = Date.now();
                const latency = endTime - startTime;
                const content = response.data.message.content;
                
                // Estimate tokens for cost calculation
                const fullPrompt = messages.map(m => m.content).join('\n');
                const estimatedInputTokens = estimateTokens(fullPrompt);
                const estimatedOutputTokens = estimateTokens(content);
                
                console.log(`✓ Ollama request succeeded (${latency}ms)`);
                
                return {
                    content,
                    usage: {
                        inputTokens: estimatedInputTokens,
                        outputTokens: estimatedOutputTokens,
                        totalTokens: estimatedInputTokens + estimatedOutputTokens,
                        totalCost: 0 // Local models are free
                    }
                };
            } catch (error) {
                lastError = error;
                
                // Check if we should retry
                const isTimeout = error.code === 'ECONNABORTED';
                const isNetworkError = error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED';
                const shouldRetry = (isTimeout || isNetworkError) && attempt < maxRetries;
                
                if (shouldRetry) {
                    console.warn(`Ollama request failed (${error.code || error.message}), will retry...`);
                    continue;
                }
                
                console.error('Error calling Ollama chat API (final):', error);
                break;
            }
        }

        // All retries failed, format and throw the error
        let errorMessage = 'Unknown error occurred';
        if (lastError.code === 'ECONNABORTED') {
            errorMessage = `Request timeout - Ollama took too long to respond (>${this.timeout/1000}s). The model may be too large or your system may be under load.`;
        } else if (lastError.code === 'ECONNREFUSED') {
            errorMessage = 'Cannot connect to Ollama - Please ensure Ollama is running';
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
     * Transform messages array to include images in the last user message
     * @param {Array} messages - Array of message objects
     * @param {Array} images - Array of image data URLs (optional)
     * @returns {Array} Transformed messages
     * @private
     */
    _transformMessagesWithImages(messages, images) {
        if (!images || images.length === 0) {
            return messages;
        }

        // Ollama expects base64 images without the data URL prefix
        const base64Images = images.map(img => {
            // Remove data:image/...;base64, prefix if present
            return img.replace(/^data:image\/[a-z]+;base64,/, '');
        });

        // Add images to the last user message
        return messages.map((message, index) => {
            if (message.role === 'user' && index === messages.length - 1) {
                return {
                    ...message,
                    images: base64Images
                };
            }
            return message;
        });
    }

    /**
     * Send a text-only message using generate API
     * @private
     */
    async _sendTextMessage(modelId, systemPrompt, message, options) {
        // Combine system prompt and user message
        let fullPrompt = message;
        if (systemPrompt) {
            fullPrompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;
        }
        
        const response = await axios.post(`${this.baseURL}/api/generate`, {
            model: modelId,
            prompt: fullPrompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                num_predict: options.max_tokens || 8000
            }
        }, {
            timeout: this.timeout
        });

        const content = response.data.response;
        
        // Ollama doesn't provide detailed cost information, but we can estimate tokens
        const estimatedInputTokens = estimateTokens(fullPrompt);
        const estimatedOutputTokens = estimateTokens(content);
        
        return {
            content,
            usage: {
                inputTokens: estimatedInputTokens,
                outputTokens: estimatedOutputTokens,
                totalTokens: estimatedInputTokens + estimatedOutputTokens,
                totalCost: 0 // Local models are free
            }
        };
    }

    /**
     * Send a multimodal message with images using chat API
     * @private
     */
    async _sendVisionMessage(modelId, systemPrompt, message, options) {
        const messages = [];
        
        // Add system message if provided
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }
        
        // Build user message with images
        // Ollama expects base64 images without the data URL prefix
        const images = options.images.map(img => {
            // Remove data:image/...;base64, prefix if present
            return img.replace(/^data:image\/[a-z]+;base64,/, '');
        });
        
        messages.push({
            role: 'user',
            content: message,
            images: images
        });
        
        const response = await axios.post(`${this.baseURL}/api/chat`, {
            model: modelId,
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                num_predict: options.max_tokens || 8000
            }
        }, {
            timeout: this.timeout
        });

        const content = response.data.message.content;
        
        // Estimate tokens
        const fullPrompt = `${systemPrompt}\n\n${message}`;
        const estimatedInputTokens = estimateTokens(fullPrompt);
        const estimatedOutputTokens = estimateTokens(content);
        
        return {
            content,
            usage: {
                inputTokens: estimatedInputTokens,
                outputTokens: estimatedOutputTokens,
                totalTokens: estimatedInputTokens + estimatedOutputTokens,
                totalCost: 0 // Local models are free
            }
        };
    }
}

module.exports = OllamaAPI;

