// TavilyAPI - Handle Tavily search API calls
const axios = require('axios');
const CONFIG = require('../../constants/config');

class TavilyAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = CONFIG.TAVILY_BASE_URL;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Search using Tavily
     * @param {string} query - Search query
     * @param {object} options - Additional search options
     * @returns {Promise<object>} Search results
     */
    async search(query, options = {}) {
        if (!this.apiKey) {
            throw new Error('Tavily API key not configured');
        }

        try {
            const response = await axios.post(`${this.baseURL}/search`, {
                api_key: this.apiKey,
                query,
                search_depth: options.search_depth || 'basic',
                include_answer: false,
                include_raw_content: false,
                max_results: options.max_results || 10
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const items = response.data?.results || [];
            const results = items.map((r, i) => ({
                title: r.title,
                url: r.url,
                snippet: r.content || '',
                rank: i + 1
            }));

            return { provider: 'tavily', results };
        } catch (error) {
            console.error('Tavily Search Error:', error.response?.data || error.message);
            return { provider: 'tavily', results: [] };
        }
    }

    /**
     * Get context for internet-enhanced prompts
     * @param {string} query - Search query
     * @returns {Promise<string>} Formatted context string
     */
    async getContext(query) {
        try {
            const response = await this.search(query, { max_results: 5 });
            
            if (!response.results || response.results.length === 0) {
                return '';
            }

            const contextParts = response.results.map((result, i) => 
                `[Source ${i + 1}]: ${result.title}\n${result.snippet}`
            );

            return `\n\n--- Internet Search Context ---\n${contextParts.join('\n\n')}\n--- End of Context ---`;
        } catch (error) {
            console.error('Error fetching Tavily context:', error);
            return '';
        }
    }
}

module.exports = TavilyAPI;

