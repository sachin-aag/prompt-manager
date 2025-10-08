// OllamaAPI - Handle Ollama local API calls
const axios = require('axios');
const { ipcRenderer } = require('electron');
const CONFIG = require('../constants/config');
const { estimateTokens } = require('../utils/formatting');

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
     * Send a message to Ollama model
     * @param {string} modelId - Model name
     * @param {string} systemPrompt - System prompt
     * @param {string} message - User message
     * @param {object} options - Additional options
     * @returns {Promise<object>} Response with content and cost info
     */
    async sendMessage(modelId, systemPrompt, message, options = {}) {
        try {
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
        } catch (error) {
            console.error('Error calling Ollama:', error);
            throw error;
        }
    }
}

module.exports = OllamaAPI;

