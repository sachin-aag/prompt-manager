// Application configuration constants

const CONFIG = {
    // API Endpoints
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    TAVILY_BASE_URL: 'https://api.tavily.com',
    PERPLEXITY_SEARCH_URL: 'https://api.perplexity.ai/search',
    BRAVE_SEARCH_URL: 'https://api.search.brave.com/res/v1/web/search',
    EXA_SEARCH_URL: 'https://api.exa.ai/search',
    
    // API Timeouts (in milliseconds)
    DEFAULT_TIMEOUT: 30000,
    OLLAMA_TIMEOUT: 60000,
    
    // Model comparison slots
    COMPARISON_SLOTS: 4,
    
    // Default values
    DEFAULT_CATEGORY: 'writing',
    DEFAULT_INTERNET_PROVIDER: 'none',
    DEFAULT_CHAT_PROVIDER: 'openrouter',
    
    // Storage keys
    STORAGE_KEYS: {
        OPENROUTER_API_KEY: 'openrouter_api_key',
        TAVILY_API_KEY: 'tavily_api_key',
        PERPLEXITY_API_KEY: 'perplexity_api_key',
        BRAVE_API_KEY: 'brave_api_key',
        EXA_API_KEY: 'exa_api_key',
        SYSTEM_PROMPTS: 'system_prompts'
    },
    
    // Search providers
    SEARCH_PROVIDERS: ['perplexity', 'brave', 'tavily', 'exa'],
    
    // Internet access providers
    INTERNET_PROVIDERS: {
        NONE: 'none',
        TAVILY: 'tavily',
        OPENROUTER: 'openrouter',
        PERPLEXITY: 'perplexity',
        BRAVE: 'brave',
        EXA: 'exa'
    }
};

module.exports = CONFIG;

