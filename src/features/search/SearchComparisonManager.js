// SearchComparisonManager - Handle AEO search comparison
class SearchComparisonManager {
    constructor(perplexityAPI, braveAPI, tavilyAPI, exaAPI) {
        this.perplexityAPI = perplexityAPI;
        this.braveAPI = braveAPI;
        this.tavilyAPI = tavilyAPI;
        this.exaAPI = exaAPI;
    }

    /**
     * Run search comparison across multiple providers
     * @param {string} query - Search query
     * @param {Array} providers - Provider names to use
     * @param {object} options - Search options (country, etc.)
     * @returns {Promise<object>} Results and warnings
     */
    async runComparison(query, providers, options = {}) {
        const warnings = [];
        const promises = [];
        
        // Create promises for each provider
        if (providers.includes('perplexity')) {
            if (!this.perplexityAPI.apiKey) {
                warnings.push('Perplexity API key not configured');
                promises.push(Promise.resolve({ provider: 'perplexity', results: [] }));
            } else {
                promises.push(this.perplexityAPI.search(query, options));
            }
        }
        
        if (providers.includes('brave')) {
            if (!this.braveAPI.apiKey) {
                warnings.push('Brave API key not configured');
                promises.push(Promise.resolve({ provider: 'brave', results: [] }));
            } else {
                promises.push(this.braveAPI.search(query, options));
            }
        }
        
        if (providers.includes('tavily')) {
            if (!this.tavilyAPI.apiKey) {
                warnings.push('Tavily API key not configured');
                promises.push(Promise.resolve({ provider: 'tavily', results: [] }));
            } else {
                promises.push(this.tavilyAPI.search(query, options));
            }
        }
        
        if (providers.includes('exa')) {
            if (!this.exaAPI.apiKey) {
                warnings.push('Exa API key not configured');
                promises.push(Promise.resolve({ provider: 'exa', results: [] }));
            } else {
                promises.push(this.exaAPI.search(query, options));
            }
        }
        
        const providerResults = await Promise.all(promises);
        
        return {
            results: providerResults,
            warnings
        };
    }

    /**
     * Normalize and merge results from multiple providers
     * @param {Array} providerResults - Results from all providers
     * @returns {Array} Normalized results
     */
    normalizeResults(providerResults) {
        const urlMap = new Map();
        
        providerResults.forEach(({ provider, results }) => {
            results.forEach(result => {
                const normalizedUrl = this.normalizeUrl(result.url);
                
                if (!urlMap.has(normalizedUrl)) {
                    urlMap.set(normalizedUrl, {
                        url: result.url,
                        title: result.title,
                        content: result.snippet || '',
                        perplexity: null,
                        brave: null,
                        tavily: null,
                        exa: null
                    });
                }
                
                const entry = urlMap.get(normalizedUrl);
                entry[provider] = result.rank;
                
                // Use the first non-empty title/content we find
                if (!entry.title && result.title) entry.title = result.title;
                if (!entry.content && result.snippet) entry.content = result.snippet;
            });
        });
        
        return Array.from(urlMap.values());
    }

    /**
     * Normalize URL for comparison
     * @param {string} url - URL to normalize
     * @returns {string} Normalized URL
     */
    normalizeUrl(url) {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            return urlObj.protocol + '//' + 
                   urlObj.hostname.toLowerCase().replace(/^www\./, '') + 
                   urlObj.pathname.replace(/\/$/, '') + 
                   urlObj.search;
        } catch (e) {
            return url.toLowerCase().replace(/\/$/, '').replace(/#.*$/, '');
        }
    }
}

module.exports = SearchComparisonManager;

