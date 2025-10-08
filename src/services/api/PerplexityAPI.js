// PerplexityAPI - Handle Perplexity search API calls
const axios = require('axios');
const CONFIG = require('../../constants/config');

class PerplexityAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = CONFIG.PERPLEXITY_SEARCH_URL;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Search using Perplexity
     * @param {string} query - Search query
     * @param {object} options - Additional search options (country, max_results, etc.)
     * @returns {Promise<object>} Search results
     */
    async search(query, options = {}) {
        if (!this.apiKey) {
            throw new Error('Perplexity API key not configured');
        }

        try {
            const payload = {
                query,
                max_results: options.max_results || 10,
                max_tokens_per_page: options.max_tokens_per_page || 256
            };

            // Only add country if specified and not worldwide
            if (options.country && options.country !== 'worldwide') {
                payload.country = options.country;
            }

            const response = await axios.post(this.baseURL, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const results = (response.data?.results || []).map((r, i) => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet || '',
                rank: i + 1
            }));

            return { provider: 'perplexity', results };
        } catch (error) {
            console.error('Perplexity Search Error:', error.response?.data || error.message);
            return { provider: 'perplexity', results: [] };
        }
    }
}

module.exports = PerplexityAPI;

