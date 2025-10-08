// ComparisonManager - Handle LLM comparison functionality
const { formatCost } = require('../../utils/formatting');

class ComparisonManager {
    constructor(openRouterAPI, tavilyAPI, costCalculator) {
        this.openRouterAPI = openRouterAPI;
        this.tavilyAPI = tavilyAPI;
        this.costCalculator = costCalculator;
        
        this.internetProvider = 'none'; // 'none', 'tavily', 'openrouter'
    }

    setInternetProvider(provider) {
        this.internetProvider = provider;
    }

    /**
     * Run comparison across multiple models
     * @param {Array} models - Array of model objects {id, name, slot}
     * @param {string} systemPrompt - System prompt
     * @param {string} userMessage - User message
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} Results array
     */
    async runComparison(models, systemPrompt, userMessage, onProgress) {
        const results = [];
        
        // Fetch internet context if using Tavily
        let internetContext = '';
        if (this.internetProvider === 'tavily') {
            internetContext = await this.tavilyAPI.getContext(userMessage);
        }
        
        // Run comparisons in parallel
        const promises = models.map(async (model) => {
            try {
                if (onProgress) onProgress(model.slot, 'loading');
                
                let modelId = model.id;
                let finalMessage = userMessage + internetContext;
                
                // Handle OpenRouter web search
                if (this.internetProvider === 'openrouter') {
                    modelId = model.id + ':online';
                    finalMessage = userMessage;
                }
                
                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: finalMessage }
                ];
                
                const response = await this.openRouterAPI.sendMessage(modelId, messages);
                
                // Store generation ID for cost lookup
                if (response.generationId) {
                    this.costCalculator.storeGenerationId(model.slot, response.generationId);
                }
                
                // Add web search indicator if using OpenRouter web search
                let displayContent = response.content;
                if (modelId.includes(':online')) {
                    displayContent = `🌐 Web Search Enabled\n\n${response.content}`;
                }
                
                if (onProgress) {
                    onProgress(model.slot, 'success', {
                        content: displayContent,
                        usage: response.usage,
                        latency: response.latency
                    });
                }
                
                return {
                    slot: model.slot,
                    model: model.name,
                    content: displayContent,
                    usage: response.usage,
                    generationId: response.generationId
                };
            } catch (error) {
                if (onProgress) {
                    onProgress(model.slot, 'error', error.message);
                }
                
                return {
                    slot: model.slot,
                    model: model.name,
                    error: error.message
                };
            }
        });
        
        return await Promise.all(promises);
    }

    /**
     * Fetch detailed cost data for completed generations
     * @param {Array} results - Array of results with generationIds
     * @param {Function} onUpdate - Update callback
     */
    async fetchCostData(results, onUpdate) {
        const promises = results.map(async (result) => {
            if (!result.generationId) return null;
            
            try {
                const costData = await this.openRouterAPI.fetchCostData(result.generationId);
                
                if (onUpdate) {
                    onUpdate(result.slot, costData);
                }
                
                return {
                    slot: result.slot,
                    cost: costData
                };
            } catch (error) {
                console.error(`Error fetching cost for slot ${result.slot}:`, error);
                return null;
            }
        });
        
        return await Promise.all(promises);
    }

    /**
     * Clear all generation IDs
     */
    clearGenerationIds() {
        this.costCalculator.clearGenerationIds();
    }
}

module.exports = ComparisonManager;

