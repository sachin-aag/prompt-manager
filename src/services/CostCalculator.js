// CostCalculator - Calculate and track API costs
const { estimateTokens } = require('../utils/formatting');

class CostCalculator {
    constructor() {
        this.generationIds = new Map(); // Store generation IDs for cost lookup
    }

    /**
     * Calculate cost based on token usage and model pricing
     * @param {number} inputTokens - Number of input tokens
     * @param {number} outputTokens - Number of output tokens  
     * @param {object} pricing - Model pricing info (prompt/completion costs per token)
     * @returns {object} Cost breakdown
     */
    calculateCost(inputTokens, outputTokens, pricing) {
        if (!pricing) {
            return {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                inputCost: 0,
                outputCost: 0,
                totalCost: 0
            };
        }

        const inputCost = (inputTokens * pricing.prompt) || 0;
        const outputCost = (outputTokens * pricing.completion) || 0;
        const totalCost = inputCost + outputCost;

        return {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            inputCost,
            outputCost,
            totalCost
        };
    }

    /**
     * Estimate cost before making API call
     * @param {string} text - Input text
     * @param {object} pricing - Model pricing
     * @param {number} estimatedOutputTokens - Estimated output tokens
     * @returns {object} Estimated cost
     */
    estimateCost(text, pricing, estimatedOutputTokens = 500) {
        const inputTokens = estimateTokens(text);
        return this.calculateCost(inputTokens, estimatedOutputTokens, pricing);
    }

    /**
     * Store generation ID for later cost lookup
     * @param {number} slotNumber - Model slot number
     * @param {string} generationId - Generation ID from API
     */
    storeGenerationId(slotNumber, generationId) {
        this.generationIds.set(slotNumber, generationId);
    }

    /**
     * Get generation ID for a slot
     * @param {number} slotNumber - Model slot number
     * @returns {string|null} Generation ID or null
     */
    getGenerationId(slotNumber) {
        return this.generationIds.get(slotNumber) || null;
    }

    /**
     * Clear all stored generation IDs
     */
    clearGenerationIds() {
        this.generationIds.clear();
    }
}

module.exports = CostCalculator;

