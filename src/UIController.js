// UIController - Handles all DOM interactions and UI updates
const SearchableDropdown = require('./components/SearchableDropdown');
const { formatCost, formatCategoryName, escapeHtml } = require('./utils/formatting');

class UIController {
    constructor(app) {
        this.app = app;
        this.modelDropdowns = [];
        this.chatModelDropdown = null;
        this.chatProviderDropdown = null;
        this.chatSystemPromptDropdown = null;
        this.chatInternetDropdown = null;
        this.currentEditingPromptId = null;
        this.currentEditingUserPromptId = null;
        this.currentSessionId = null;
    }

    /**
     * Initialize the UI
     */
    async init() {
        this.setupTabs();
        this.setupModals();
        this.initializeDropdowns();
        this.setupEventListeners();
        await this.loadInitialData();
        this.updateAllUI();
    }

    /**
     * Setup tab navigation
     */
    setupTabs() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    /**
     * Switch to a different tab
     */
    switchTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`)?.classList.add('active');

        // Tab-specific initialization
        if (tabName === 'chat') {
            this.initChatTab();
        } else if (tabName === 'prompts') {
            this.updatePromptHistory();
        }
    }

    /**
     * Setup modals
     */
    setupModals() {
        const modalMgr = this.app.getManagers().modal;
        
        modalMgr.register('prompt-editor', 'prompt-editor-modal');
        modalMgr.register('system-prompt', 'system-prompt-modal');
        modalMgr.register('user-prompt', 'user-prompt-editor-modal');
        modalMgr.register('add-system-prompt', 'add-system-prompt-modal');
        modalMgr.register('prompt-session', 'prompt-session-modal');
        
        // Setup close handlers
        modalMgr.setupCloseHandlers('prompt-editor', ['close-modal', 'cancel-prompt']);
        modalMgr.setupCloseHandlers('system-prompt', ['close-system-prompt-modal', 'cancel-system-prompt']);
        modalMgr.setupCloseHandlers('user-prompt', ['close-user-modal', 'cancel-user-prompt']);
        modalMgr.setupCloseHandlers('add-system-prompt', ['close-add-system-prompt-modal', 'cancel-add-system-prompt']);
        modalMgr.setupCloseHandlers('prompt-session', ['close-prompt-session-modal', 'close-session-modal']);
    }

    /**
     * Initialize all dropdowns
     */
    initializeDropdowns() {
        // Comparison dropdowns (4 model slots)
        for (let i = 1; i <= 4; i++) {
            const dropdown = new SearchableDropdown(`dropdown-${i}`);
            dropdown.onChange = (option) => {
                console.log(`Model ${i} selected:`, option.name);
            };
            this.modelDropdowns.push(dropdown);
        }

        // Chat provider dropdown
        this.chatProviderDropdown = new SearchableDropdown('chat-provider-dropdown');
        this.chatProviderDropdown.setOptions([
            { id: 'openrouter', name: 'OpenRouter' },
            { id: 'ollama', name: 'Ollama (Local)' }
        ]);
        this.chatProviderDropdown.setValue('openrouter');
        this.chatProviderDropdown.onChange = (option) => {
            this.onChatProviderChanged(option.id);
        };

        // Chat model dropdown
        this.chatModelDropdown = new SearchableDropdown('chat-model-dropdown');
        this.chatModelDropdown.onChange = (option) => {
            this.app.chatManager.setSelectedModel(option);
            this.enableChatInterface();
        };

        // Chat internet dropdown
        this.chatInternetDropdown = new SearchableDropdown('chat-internet-dropdown');
        this.chatInternetDropdown.setOptions([
            { id: 'none', name: 'None' },
            { id: 'tavily', name: 'Tavily (External)' },
            { id: 'openrouter', name: 'OpenRouter (Built-in)' }
        ]);
        this.chatInternetDropdown.setValue('none');
        this.chatInternetDropdown.onChange = (option) => {
            this.app.chatManager.setInternetProvider(option.id);
        };

        // Chat system prompt dropdown
        this.chatSystemPromptDropdown = new SearchableDropdown('chat-system-prompt-dropdown');
        this.chatSystemPromptDropdown.onChange = (option) => {
            this.app.chatManager.setSystemPromptCategory(option.id);
            this.updateChatSystemPromptPreview();
        };
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Settings
        this.setupSettingsListeners();
        
        // Comparison
        this.setupComparisonListeners();
        
        // Chat
        this.setupChatListeners();
        
        // Prompts
        this.setupPromptListeners();
        
        // Search
        this.setupSearchListeners();
    }

    setupSettingsListeners() {
        document.getElementById('save-api-key')?.addEventListener('click', () => this.saveApiKey('openrouter'));
        document.getElementById('save-tavily-api-key')?.addEventListener('click', () => this.saveApiKey('tavily'));
        document.getElementById('save-perplexity-api-key')?.addEventListener('click', () => this.saveApiKey('perplexity'));
        document.getElementById('save-brave-api-key')?.addEventListener('click', () => this.saveApiKey('brave'));
        document.getElementById('save-exa-api-key')?.addEventListener('click', () => this.saveApiKey('exa'));
        document.getElementById('refresh-models-btn')?.addEventListener('click', () => this.refreshModels());
    }

    setupComparisonListeners() {
        document.getElementById('run-comparison-btn')?.addEventListener('click', () => this.runComparison());
        document.getElementById('clear-comparison-btn')?.addEventListener('click', () => this.clearComparison());
        document.getElementById('category-select')?.addEventListener('change', (e) => this.updateSystemPromptContent(e.target.value));
        document.getElementById('add-system-prompt-btn')?.addEventListener('click', () => this.openAddSystemPromptModal());
        document.getElementById('edit-system-prompt-btn')?.addEventListener('click', () => this.openSystemPromptEditor());
        document.getElementById('save-system-prompt')?.addEventListener('click', () => this.saveSystemPrompt());
        document.getElementById('internet-access-select')?.addEventListener('change', (e) => this.onInternetAccessChanged(e.target.value));
    }

    setupChatListeners() {
        document.getElementById('chat-send-btn')?.addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chat-message-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
    }

    setupPromptListeners() {
        document.getElementById('new-prompt-btn')?.addEventListener('click', () => this.openAddSystemPromptModal());
        document.getElementById('save-prompt')?.addEventListener('click', () => this.savePrompt());
        document.getElementById('save-add-system-prompt')?.addEventListener('click', () => this.saveNewSystemPrompt());
        document.getElementById('import-btn')?.addEventListener('click', () => this.importPrompts());
        document.getElementById('export-btn')?.addEventListener('click', () => this.exportPrompts());
        document.getElementById('prompt-history-search')?.addEventListener('input', (e) => this.searchPromptHistory(e.target.value));
        
        // Session modal listeners
        document.getElementById('delete-session-btn')?.addEventListener('click', () => this.deleteSession());
    }

    setupSearchListeners() {
        document.getElementById('perplexity-search-btn')?.addEventListener('click', () => this.runSearchComparison());
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        // Load API keys into form fields
        const keys = this.app.storage.getApiKey ? {
            openrouter: this.app.storage.getApiKey('openrouter'),
            tavily: this.app.storage.getApiKey('tavily'),
            perplexity: this.app.storage.getApiKey('perplexity'),
            brave: this.app.storage.getApiKey('brave'),
            exa: this.app.storage.getApiKey('exa')
        } : {};

        document.getElementById('api-key')?.setAttribute('value', keys.openrouter || '');
        document.getElementById('tavily-api-key')?.setAttribute('value', keys.tavily || '');
        document.getElementById('perplexity-api-key')?.setAttribute('value', keys.perplexity || '');
        document.getElementById('brave-api-key')?.setAttribute('value', keys.brave || '');
        document.getElementById('exa-api-key')?.setAttribute('value', keys.exa || '');
    }

    /**
     * Update all UI elements
     */
    updateAllUI() {
        this.updateModelDropdowns();
        this.updateChatModelDropdown();
        this.updateSystemPromptDropdown();
        this.updateChatSystemPromptDropdown();
        this.updateSystemPromptContent();
        this.updateSystemPromptsGrid();
    }

    /**
     * Update system prompts grid display
     */
    updateSystemPromptsGrid() {
        const grid = document.getElementById('prompts-grid');
        if (!grid) return;

        const categories = this.app.systemPromptManager.getCategories();
        
        grid.innerHTML = categories.map(category => {
            const content = this.app.systemPromptManager.get(category);
            const isDefault = this.app.systemPromptManager.isDefault(category);
            const truncated = content.substring(0, 200) + (content.length > 200 ? '...' : '');
            
            return `
                <div class="prompt-card">
                    <div class="prompt-card-header">
                        <h3>${formatCategoryName(category)}</h3>
                        ${isDefault ? '<span class="badge-default">Default</span>' : '<span class="badge-custom">Custom</span>'}
                    </div>
                    <div class="prompt-card-body">
                        <p class="prompt-preview">${escapeHtml(truncated)}</p>
                    </div>
                    <div class="prompt-card-footer">
                        <button class="btn btn-secondary btn-sm" onclick="window.app.ui.editSystemPromptFromGrid('${category}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        ${!isDefault ? `
                            <button class="btn btn-danger btn-sm" onclick="window.app.ui.deleteSystemPromptFromGrid('${category}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        ` : ''}
                        <button class="btn btn-primary btn-sm" onclick="window.app.ui.useSystemPromptInComparison('${category}')">
                            <i class="fas fa-arrow-right"></i> Use in Comparison
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Edit system prompt from grid
     */
    editSystemPromptFromGrid(category) {
        // Switch to comparison tab and set the category
        this.switchTab('comparison');
        const select = document.getElementById('category-select');
        if (select) {
            select.value = category;
            this.updateSystemPromptContent(category);
        }
        // Open the editor
        this.openSystemPromptEditor();
    }

    /**
     * Delete system prompt from grid
     */
    deleteSystemPromptFromGrid(category) {
        if (confirm(`Are you sure you want to delete the "${formatCategoryName(category)}" system prompt?`)) {
            const deleted = this.app.systemPromptManager.delete(category);
            if (deleted) {
                this.updateSystemPromptsGrid();
                this.updateSystemPromptDropdown();
                this.updateChatSystemPromptDropdown();
                alert('System prompt deleted successfully!');
            } else {
                alert('Cannot delete default system prompts. You can only edit them.');
            }
        }
    }

    /**
     * Use system prompt in comparison
     */
    useSystemPromptInComparison(category) {
        this.switchTab('comparison');
        const select = document.getElementById('category-select');
        if (select) {
            select.value = category;
            this.updateSystemPromptContent(category);
        }
    }

    /**
     * Update model dropdowns with available models
     */
    updateModelDropdowns() {
        const models = this.app.settingsManager.getAvailableModels();
        const options = models.map(m => ({
            id: m.id,
            name: m.name || m.id
        }));

        this.modelDropdowns.forEach(dropdown => {
            dropdown.setOptions(options);
        });
    }

    /**
     * Update chat model dropdown
     */
    updateChatModelDropdown() {
        const provider = this.app.chatManager.provider;
        let models = [];

        if (provider === 'ollama') {
            models = this.app.settingsManager.getOllamaModels();
        } else {
            models = this.app.settingsManager.getAvailableModels();
        }

        const options = models.map(m => ({
            id: m.id,
            name: m.name || m.id
        }));

        this.chatModelDropdown?.setOptions(options);
    }

    /**
     * Update system prompt dropdown in comparison tab
     */
    updateSystemPromptDropdown() {
        const select = document.getElementById('category-select');
        if (!select) return;

        select.innerHTML = '';
        const categories = this.app.systemPromptManager.getCategories();
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = formatCategoryName(category);
            select.appendChild(option);
        });
    }

    /**
     * Update chat system prompt dropdown
     */
    updateChatSystemPromptDropdown() {
        const categories = this.app.systemPromptManager.getCategories();
        const options = categories.map(cat => ({
            id: cat,
            name: formatCategoryName(cat)
        }));

        this.chatSystemPromptDropdown?.setOptions(options);
        this.chatSystemPromptDropdown?.setValue('writing');
        this.updateChatSystemPromptPreview();
    }

    /**
     * Update system prompt content display
     */
    updateSystemPromptContent(category) {
        const cat = category || document.getElementById('category-select')?.value || 'writing';
        const content = this.app.systemPromptManager.get(cat);
        const container = document.getElementById('system-prompt-content');
        
        if (container) {
            container.textContent = content;
        }
    }

    /**
     * Update chat system prompt preview
     */
    updateChatSystemPromptPreview() {
        const category = this.app.chatManager.systemPromptCategory;
        const content = this.app.systemPromptManager.get(category);
        const preview = document.getElementById('chat-system-prompt-preview');
        
        if (preview) {
            const truncated = content.substring(0, 200) + '...';
            preview.textContent = truncated;
        }
    }

    /**
     * Save API key
     */
    async saveApiKey(provider) {
        const inputId = provider === 'openrouter' ? 'api-key' : `${provider}-api-key`;
        const input = document.getElementById(inputId);
        const apiKey = input?.value.trim();

        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }

        this.app.settingsManager.saveApiKey(provider, apiKey);
        alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key saved successfully!`);

        // Reload models if OpenRouter key was saved
        if (provider === 'openrouter') {
            await this.refreshModels();
        }
    }

    /**
     * Refresh available models
     */
    async refreshModels() {
        const btn = document.getElementById('refresh-models-btn');
        if (btn) btn.disabled = true;

        try {
            await this.app.settingsManager.loadAvailableModels();
            this.updateModelDropdowns();
            this.updateChatModelDropdown();
            alert('Models refreshed successfully!');
        } catch (error) {
            alert('Failed to refresh models: ' + error.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Run LLM comparison
     */
    async runComparison() {
        const systemPrompt = this.app.systemPromptManager.get(
            document.getElementById('category-select')?.value || 'writing'
        );
        const userMessage = document.getElementById('user-message')?.value.trim();

        if (!userMessage) {
            alert('Please enter a message to send to the models.');
            return;
        }

        // Get selected models
        const selectedModels = [];
        for (let i = 0; i < 4; i++) {
            const dropdown = this.modelDropdowns[i];
            const value = dropdown.getValue();
            if (value) {
                const option = dropdown.options.find(opt => opt.id === value);
                if (option) {
                    selectedModels.push({
                        id: option.id,
                        name: option.name,
                        slot: i + 1
                    });
                }
            }
        }

        if (selectedModels.length === 0) {
            alert('Please select at least one model to compare.');
            return;
        }

        // Set internet provider
        const internetProvider = document.getElementById('internet-access-select')?.value || 'none';
        this.app.comparisonManager.setInternetProvider(internetProvider);

        // Run comparison
        const results = await this.app.comparisonManager.runComparison(
            selectedModels,
            systemPrompt,
            userMessage,
            (slot, status, data) => this.onComparisonProgress(slot, status, data)
        );

        // Wait and fetch cost data
        await new Promise(resolve => setTimeout(resolve, 10000));
        await this.app.comparisonManager.fetchCostData(results, (slot, costData) => {
            this.updateCostDisplay(slot, costData);
        });

        // Save session
        const responses = results.filter(r => !r.error).map(r => ({
            model: r.model,
            content: r.content,
            cost: r.usage
        }));

        if (responses.length > 0) {
            await this.app.promptSessionManager.create(systemPrompt, userMessage, responses);
        }
    }

    /**
     * Handle comparison progress updates
     */
    onComparisonProgress(slot, status, data) {
        const output = document.getElementById(`output-${slot}`);
        if (!output) return;

        if (status === 'loading') {
            output.innerHTML = '<div class="loading-spinner">Loading...</div>';
            output.classList.add('loading');
        } else if (status === 'success') {
            output.classList.remove('loading');
            output.textContent = data.content;
            
            if (data.usage) {
                this.updateCostDisplay(slot, data.usage);
            }
        } else if (status === 'error') {
            output.classList.remove('loading');
            output.textContent = `Error: ${data}`;
        }
    }

    /**
     * Update cost display for a slot
     */
    updateCostDisplay(slot, costData) {
        const costDisplay = document.getElementById(`cost-${slot}`);
        if (!costDisplay) return;

        let costText;
        if (costData.totalCost > 0) {
            costText = `${formatCost(costData.totalCost)} (${costData.inputTokens}→${costData.outputTokens} tokens)`;
        } else {
            costText = `${costData.inputTokens}→${costData.outputTokens} tokens`;
        }

        costDisplay.textContent = costText;
        costDisplay.style.display = 'block';
    }

    /**
     * Clear comparison outputs
     */
    clearComparison() {
        for (let i = 1; i <= 4; i++) {
            const output = document.getElementById(`output-${i}`);
            const cost = document.getElementById(`cost-${i}`);
            if (output) output.innerHTML = '<div class="output-placeholder">Model ' + i + ' output will appear here</div>';
            if (cost) cost.style.display = 'none';
        }
        document.getElementById('user-message').value = '';
    }

    /**
     * Send chat message
     */
    async sendChatMessage() {
        const input = document.getElementById('chat-message-input');
        const message = input?.value.trim();

        if (!message) return;

        const systemPrompt = this.app.systemPromptManager.get(this.app.chatManager.systemPromptCategory);

        // Add user message to UI
        this.addChatMessage('user', message);
        input.value = '';

        // Show loading
        const loadingEl = this.addChatLoadingMessage();

        try {
            const response = await this.app.chatManager.sendMessage(message, systemPrompt);
            this.removeChatLoadingMessage(loadingEl);
            this.addChatMessage('assistant', response.content, response.usage);
        } catch (error) {
            this.removeChatLoadingMessage(loadingEl);
            this.addChatMessage('assistant', `Error: ${error.message}`, null, true);
        }
    }

    /**
     * Add chat message to UI
     */
    addChatMessage(role, content, cost = null, isError = false) {
        const container = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${role}`;
        if (isError) {
            bubble.style.background = '#fee2e2';
            bubble.style.color = '#dc2626';
        }
        bubble.textContent = content;

        messageDiv.appendChild(bubble);

        if (role === 'assistant' && cost && cost.totalCost > 0) {
            const info = document.createElement('div');
            info.className = 'message-info';
            info.textContent = formatCost(cost.totalCost);
            messageDiv.appendChild(info);
        }

        container?.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        return messageDiv;
    }

    /**
     * Add chat loading message
     */
    addChatLoadingMessage() {
        const container = document.getElementById('chat-messages');
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message assistant';
        loadingDiv.innerHTML = '<div class="message-loading"><div class="loading-spinner"></div><span>Thinking...</span></div>';
        container?.appendChild(loadingDiv);
        container.scrollTop = container.scrollHeight;
        return loadingDiv;
    }

    /**
     * Remove chat loading message
     */
    removeChatLoadingMessage(element) {
        element?.remove();
    }

    /**
     * Enable chat interface
     */
    enableChatInterface() {
        const input = document.getElementById('chat-message-input');
        const btn = document.getElementById('chat-send-btn');

        if (input) {
            input.disabled = false;
            input.placeholder = 'Type your message...';
        }
        if (btn) btn.disabled = false;
    }

    /**
     * Disable chat interface
     */
    disableChatInterface() {
        const input = document.getElementById('chat-message-input');
        const btn = document.getElementById('chat-send-btn');

        if (input) {
            input.disabled = true;
            input.placeholder = 'Select a model to start chatting...';
        }
        if (btn) btn.disabled = true;
    }

    /**
     * Handle chat provider change
     */
    async onChatProviderChanged(provider) {
        this.app.chatManager.setProvider(provider);

        if (provider === 'ollama') {
            await this.app.settingsManager.loadOllamaModels();
        }

        this.updateChatModelDropdown();
        this.disableChatInterface();
    }

    /**
     * Handle internet access change
     */
    onInternetAccessChanged(provider) {
        this.app.comparisonManager.setInternetProvider(provider);
        // Update UI info if needed
    }

    /**
     * Initialize chat tab
     */
    initChatTab() {
        // Any chat-specific initialization
    }

    /**
     * Open add system prompt modal
     */
    openAddSystemPromptModal() {
        this.app.getManagers().modal.open('add-system-prompt');
        // Clear the form
        document.getElementById('new-system-prompt-category').value = '';
        document.getElementById('new-system-prompt-content').value = '';
    }

    /**
     * Save new system prompt
     */
    saveNewSystemPrompt() {
        const categoryInput = document.getElementById('new-system-prompt-category');
        const contentInput = document.getElementById('new-system-prompt-content');
        
        const category = categoryInput?.value.trim().toLowerCase().replace(/\s+/g, '-');
        const content = contentInput?.value.trim();

        if (!category || !content) {
            alert('Please fill in both category name and content.');
            return;
        }

        // Check if category already exists
        const existingCategories = this.app.systemPromptManager.getCategories();
        if (existingCategories.includes(category)) {
            alert('A system prompt with this name already exists. Please choose a different name.');
            return;
        }

        // Save the new system prompt
        this.app.systemPromptManager.set(category, content);
        
        // Update UI
        this.updateSystemPromptsGrid();
        this.updateSystemPromptDropdown();
        this.updateChatSystemPromptDropdown();
        
        // Close modal
        this.app.getManagers().modal.close('add-system-prompt');
        
        alert('System prompt added successfully!');
    }

    /**
     * Open prompt editor
     */
    openPromptEditor(promptId = null) {
        // Implementation for opening prompt editor modal
        this.app.getManagers().modal.open('prompt-editor', { promptId });
    }

    /**
     * Save prompt
     */
    async savePrompt() {
        // Implementation for saving prompt
    }

    /**
     * Open system prompt editor
     */
    openSystemPromptEditor() {
        this.app.getManagers().modal.open('system-prompt');
        const category = document.getElementById('category-select')?.value || 'writing';
        const content = this.app.systemPromptManager.get(category);
        document.getElementById('system-prompt-textarea').value = content;
        document.getElementById('modal-category-name').textContent = formatCategoryName(category);
    }

    /**
     * Save system prompt
     */
    saveSystemPrompt() {
        const category = document.getElementById('category-select')?.value || 'writing';
        const content = document.getElementById('system-prompt-textarea')?.value;

        if (content) {
            this.app.systemPromptManager.set(category, content);
            this.updateSystemPromptContent(category);
            this.app.getManagers().modal.close('system-prompt');
            alert('System prompt saved successfully!');
        }
    }

    /**
     * Import prompts
     */
    async importPrompts() {
        // Implementation for importing prompts
    }

    /**
     * Export prompts
     */
    async exportPrompts() {
        // Implementation for exporting prompts
    }

    /**
     * Update prompt history
     */
    updatePromptHistory() {
        const sessions = this.app.promptSessionManager.getAll();
        const container = document.getElementById('prompt-history-list');
        
        if (!container) return;

        if (sessions.length === 0) {
            container.innerHTML = '<div class="prompt-history-empty"><i class="fas fa-history"></i><h4>No Previous Prompts</h4><p>Run some comparisons to see your history here</p></div>';
            return;
        }

        container.innerHTML = sessions.map(session => {
            const date = new Date(session.timestamp).toLocaleDateString();
            const time = new Date(session.timestamp).toLocaleTimeString();
            const preview = session.userPrompt.substring(0, 100) + (session.userPrompt.length > 100 ? '...' : '');
            const modelsText = session.models.join(', ');
            
            return `
                <div class="prompt-history-item" data-session-id="${session.id}">
                    <div class="prompt-history-item-header">
                        <h4 class="prompt-history-title">${escapeHtml(preview)}</h4>
                        <div class="prompt-history-meta">
                            <div class="prompt-history-date">${date} ${time}</div>
                            <div class="prompt-history-models">${modelsText}</div>
                        </div>
                    </div>
                    <p class="prompt-history-preview">${escapeHtml(preview)}</p>
                    <div class="prompt-history-item-actions">
                        <button class="prompt-history-delete-btn" onclick="event.stopPropagation(); window.app.ui.deleteSessionById('${session.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.prompt-history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.prompt-history-delete-btn')) {
                    this.showSessionDetail(item.dataset.sessionId);
                }
            });
        });
    }

    /**
     * Delete session by ID (called from inline onclick)
     */
    async deleteSessionById(sessionId) {
        if (!confirm('Are you sure you want to delete this prompt session?')) {
            return;
        }

        try {
            const deleted = await this.app.promptSessionManager.delete(sessionId);
            if (deleted) {
                this.updatePromptHistory();
                alert('Session deleted successfully!');
            } else {
                alert('Failed to delete session.');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            alert('Failed to delete session.');
        }
    }

    /**
     * Show session detail
     */
    showSessionDetail(sessionId) {
        const session = this.app.promptSessionManager.get(sessionId);
        if (!session) {
            console.error('Session not found:', sessionId);
            return;
        }

        // Update modal content
        document.getElementById('session-date').textContent = new Date(session.timestamp).toLocaleString();
        document.getElementById('session-models').textContent = session.models.join(', ');
        document.getElementById('session-system-prompt').textContent = session.systemPrompt;
        document.getElementById('session-user-prompt').textContent = session.userPrompt;

        // Render responses
        const responsesContainer = document.getElementById('session-responses');
        if (responsesContainer && session.responses) {
            responsesContainer.innerHTML = session.responses.map(response => `
                <div class="response-item">
                    <div class="response-header">
                        <span class="response-model">${response.model}</span>
                        <span class="response-cost">$${response.cost?.totalCost?.toFixed(4) || 'N/A'}</span>
                    </div>
                    <div class="response-content">${escapeHtml(response.content)}</div>
                </div>
            `).join('');
        }

        // Store current session ID for deletion
        this.currentSessionId = sessionId;

        // Show modal
        document.getElementById('prompt-session-modal').style.display = 'flex';
    }

    /**
     * Delete session
     */
    async deleteSession() {
        if (!this.currentSessionId) return;
        
        if (!confirm('Are you sure you want to delete this prompt session?')) {
            return;
        }

        try {
            const deleted = await this.app.promptSessionManager.delete(this.currentSessionId);
            if (deleted) {
                // Close modal
                document.getElementById('prompt-session-modal').style.display = 'none';
                // Refresh history
                this.updatePromptHistory();
                alert('Session deleted successfully!');
            } else {
                alert('Failed to delete session.');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            alert('Failed to delete session.');
        }
    }

    /**
     * Search prompt history
     */
    searchPromptHistory(searchTerm) {
        const items = document.querySelectorAll('.prompt-history-item');
        const term = searchTerm.toLowerCase();

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(term) ? 'block' : 'none';
        });
    }

    /**
     * Run search comparison
     */
    async runSearchComparison() {
        const query = document.getElementById('perplexity-query')?.value.trim();
        const country = document.getElementById('perplexity-country')?.value;

        if (!query) {
            alert('Please enter a search query');
            return;
        }

        const providers = [];
        document.querySelectorAll('#search-providers input:checked').forEach(checkbox => {
            providers.push(checkbox.value);
        });

        const resultsContainer = document.getElementById('perplexity-results');
        resultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner"></i><p>Searching...</p></div>';

        try {
            const { results, warnings } = await this.app.searchComparisonManager.runComparison(
                query,
                providers,
                { country }
            );

            this.displaySearchResults(results, warnings);
        } catch (error) {
            resultsContainer.innerHTML = `<div class="search-error">Error: ${error.message}</div>`;
        }
    }

    /**
     * Display search results
     */
    displaySearchResults(results, warnings) {
        const container = document.getElementById('perplexity-results');
        const normalized = this.app.searchComparisonManager.normalizeResults(results);

        let html = '';
        if (warnings.length > 0) {
            html += `<div class="search-warning">${warnings.join(', ')}</div>`;
        }

        html += '<table class="results-table"><thead><tr>';
        html += '<th>Title</th><th>URL</th>';
        results.forEach(r => {
            html += `<th>${r.provider}</th>`;
        });
        html += '</tr></thead><tbody>';

        normalized.forEach(item => {
            html += '<tr>';
            html += `<td>${escapeHtml(item.title)}</td>`;
            html += `<td><a href="${item.url}" target="_blank">${item.url}</a></td>`;
            results.forEach(r => {
                const rank = item[r.provider];
                html += `<td>${rank || '—'}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }
}

module.exports = UIController;

