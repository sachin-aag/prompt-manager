// App.js - Main application orchestrator
// This is the central coordinator that initializes all services and managers

// Core services
const StorageService = require('./services/StorageService');
const CostCalculator = require('./services/CostCalculator');

// API services
const OpenRouterAPI = require('./services/api/OpenRouterAPI');
const OllamaAPI = require('./services/api/OllamaAPI');
const TavilyAPI = require('./services/api/TavilyAPI');
const PerplexityAPI = require('./services/api/PerplexityAPI');
const BraveAPI = require('./services/api/BraveAPI');
const ExaAPI = require('./services/api/ExaAPI');

// Feature managers
const ChatManager = require('./features/chat/ChatManager');
const ComparisonManager = require('./features/comparison/ComparisonManager');
const SystemPromptManager = require('./features/prompts/SystemPromptManager');
const UserPromptManager = require('./features/prompts/UserPromptManager');
const PromptSessionManager = require('./features/prompts/PromptSessionManager');
const SearchComparisonManager = require('./features/search/SearchComparisonManager');
const SettingsManager = require('./features/settings/SettingsManager');

// Components
const SearchableDropdown = require('./components/SearchableDropdown');
const ModalManager = require('./components/ModalManager');

// UI controller - handles all DOM interactions
const UIController = require('./UIController');

class App {
    constructor() {
        console.log('Initializing Prompt Manager App...');
        
        // Initialize core services
        this.storage = new StorageService();
        this.costCalculator = new CostCalculator();
        
        // Load API keys
        const apiKeys = this.loadApiKeys();
        
        // Initialize API services
        this.openRouterAPI = new OpenRouterAPI(apiKeys.openrouter);
        this.ollamaAPI = new OllamaAPI();
        this.tavilyAPI = new TavilyAPI(apiKeys.tavily);
        this.perplexityAPI = new PerplexityAPI(apiKeys.perplexity);
        this.braveAPI = new BraveAPI(apiKeys.brave);
        this.exaAPI = new ExaAPI(apiKeys.exa);
        
        // Initialize feature managers
        this.chatManager = new ChatManager(
            this.openRouterAPI,
            this.ollamaAPI,
            this.tavilyAPI,
            this.storage,
            {
                perplexityAPI: this.perplexityAPI,
                braveAPI: this.braveAPI,
                exaAPI: this.exaAPI
            }
        );
        
        this.comparisonManager = new ComparisonManager(
            this.openRouterAPI,
            this.tavilyAPI,
            this.costCalculator,
            {
                perplexityAPI: this.perplexityAPI,
                braveAPI: this.braveAPI,
                exaAPI: this.exaAPI
            }
        );
        
        this.systemPromptManager = new SystemPromptManager(this.storage);
        this.userPromptManager = new UserPromptManager(this.storage);
        this.promptSessionManager = new PromptSessionManager(this.storage);
        
        this.searchComparisonManager = new SearchComparisonManager(
            this.perplexityAPI,
            this.braveAPI,
            this.tavilyAPI,
            this.exaAPI
        );
        
        this.settingsManager = new SettingsManager(
            this.storage,
            this.openRouterAPI,
            this.ollamaAPI
        );
        
        // Initialize components
        this.modalManager = new ModalManager();
        
        // Initialize UI controller
        this.ui = new UIController(this);
        
        // Start initialization
        this.init();
    }

    /**
     * Load API keys from storage
     * @returns {object} API keys
     */
    loadApiKeys() {
        return {
            openrouter: this.storage.getApiKey('openrouter'),
            tavily: this.storage.getApiKey('tavily'),
            perplexity: this.storage.getApiKey('perplexity'),
            brave: this.storage.getApiKey('brave'),
            exa: this.storage.getApiKey('exa')
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Loading user data...');
            
            // Load user data
            await this.userPromptManager.load();
            await this.promptSessionManager.load();
            
            // Load models if API key is configured
            if (this.storage.getApiKey('openrouter')) {
                await this.settingsManager.loadAvailableModels();
            }
            
            // Initialize UI
            await this.ui.init();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }

    /**
     * Get all managers (for UI access)
     * @returns {object} All managers
     */
    getManagers() {
        return {
            chat: this.chatManager,
            comparison: this.comparisonManager,
            systemPrompt: this.systemPromptManager,
            userPrompt: this.userPromptManager,
            promptSession: this.promptSessionManager,
            searchComparison: this.searchComparisonManager,
            settings: this.settingsManager,
            modal: this.modalManager
        };
    }
}

module.exports = App;

