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
                const models = response.data.models.map(model => ({
                    id: model.name,
                    name: model.name,
                    size: model.size,
                    modified_at: model.modified_at
                }));
                
                console.log(`Loaded ${models.length} Ollama models`);
                return models;
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
     * Send a chat message with full conversation history using chat API
     * @param {string} modelId - Model name
     * @param {Array} messages - Array of message objects {role, content}
     * @param {object} options - Additional options (temperature, max_tokens, images)
     * @returns {Promise<object>} Response with content and cost info
     */
    async sendChatMessage(modelId, messages, options = {}) {
        try {
            // Transform messages to include images in the last user message if provided
            const transformedMessages = this._transformMessagesWithImages(messages, options.images);
            
            const response = await axios.post(`${this.baseURL}/api/chat`, {
                model: modelId,
                messages: transformedMessages,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    num_predict: options.max_tokens || 1000
                }
            }, {
                timeout: this.timeout
            });

            const content = response.data.message.content;
            
            // Estimate tokens for cost calculation
            const fullPrompt = messages.map(m => m.content).join('\n');
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
        } catch (error) {
            console.error('Error calling Ollama chat API:', error);
            throw error;
        }
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
                num_predict: options.max_tokens || 1000
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
                num_predict: options.max_tokens || 1000
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

