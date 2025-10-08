// ExaAPI - Handle Exa search API calls
const axios = require('axios');
const CONFIG = require('../../constants/config');

class ExaAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = CONFIG.EXA_SEARCH_URL;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Search using Exa
     * @param {string} query - Search query
     * @param {object} options - Additional search options
     * @returns {Promise<object>} Search results
     */
    async search(query, options = {}) {
        if (!this.apiKey) {
            throw new Error('Exa API key not configured');
        }

        try {
            const response = await axios.post(this.baseURL, {
                query,
                numResults: options.numResults || 10
            }, {
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            const items = response.data?.results || response.data?.documents || [];
            const results = items.map((r, i) => ({
                title: r.title || r.url,
                url: r.url,
                snippet: r.text || r.snippet || '',
                rank: i + 1
            }));

            return { provider: 'exa', results };
        } catch (error) {
            console.error('Exa Search Error:', error.response?.data || error.message);
            return { provider: 'exa', results: [] };
        }
    }
}

module.exports = ExaAPI;

