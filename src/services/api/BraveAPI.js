// BraveAPI - Handle Brave search API calls
const axios = require('axios');
const CONFIG = require('../../constants/config');

class BraveAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = CONFIG.BRAVE_SEARCH_URL;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Search using Brave
     * @param {string} query - Search query
     * @param {object} options - Additional search options (country, count, etc.)
     * @returns {Promise<object>} Search results
     */
    async search(query, options = {}) {
        if (!this.apiKey) {
            throw new Error('Brave API key not configured');
        }

        try {
            const params = new URLSearchParams({
                q: query,
                count: options.count || '10'
            });

            // Only add country if specified and not worldwide
            if (options.country && options.country !== 'worldwide') {
                params.set('country', options.country.toLowerCase());
            }

            const response = await axios.get(`${this.baseURL}?${params.toString()}`, {
                headers: {
                    'X-Subscription-Token': this.apiKey,
                    'Accept': 'application/json'
                }
            });

            const items = response.data?.web?.results || [];
            const results = items.map((r, i) => ({
                title: r.title,
                url: r.url,
                snippet: r.description || '',
                rank: i + 1
            }));

            return { provider: 'brave', results };
        } catch (error) {
            console.error('Brave Search Error:', error.response?.data || error.message);
            return { provider: 'brave', results: [] };
        }
    }

    /**
     * Get context for internet-enhanced prompts
     * @param {string} query - Search query
     * @returns {Promise<string>} Formatted context string
     */
    async getContext(query) {
        try {
            const response = await this.search(query, { count: 5 });
            const items = response.results || [];
            if (items.length === 0) return '';
            const contextParts = items.map((result, i) =>
                `[Source ${i + 1}]: ${result.title}\n${result.snippet}`
            );
            return `\n\n--- Internet Search Context ---\n${contextParts.join('\n\n')}\n--- End of Context ---`;
        } catch (error) {
            console.error('Error fetching Brave context:', error);
            return '';
        }
    }
}

module.exports = BraveAPI;

