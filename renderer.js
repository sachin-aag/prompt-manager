const { ipcRenderer } = require('electron');
const axios = require('axios');

// SearchableDropdown class
class SearchableDropdown {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.searchInput = this.container.querySelector('.dropdown-search');
        this.menu = this.container.querySelector('.dropdown-menu');
        this.arrow = this.container.querySelector('.dropdown-arrow');
        this.options = [];
        this.filteredOptions = [];
        this.selectedValue = '';
        this.selectedIndex = -1;
        this.isOpen = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search input events
        this.searchInput.addEventListener('input', (e) => {
            this.filterOptions(e.target.value);
            this.open();
        });

        this.searchInput.addEventListener('focus', () => {
            this.open();
        });

        this.searchInput.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
    }

    setOptions(options) {
        this.options = options;
        this.filteredOptions = [...options];
        this.renderOptions();
    }

    filterOptions(searchTerm) {
        const term = searchTerm.toLowerCase();
        this.filteredOptions = this.options.filter(option => 
            option.name.toLowerCase().includes(term)
        );
        this.selectedIndex = -1;
        this.renderOptions();
    }

    renderOptions() {
        this.menu.innerHTML = '';
        
        if (this.filteredOptions.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'dropdown-no-results';
            noResults.textContent = 'No models found';
            this.menu.appendChild(noResults);
            return;
        }

        this.filteredOptions.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = option.name;
            item.dataset.value = option.id;
            
            if (option.id === this.selectedValue) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', () => {
                this.selectOption(option);
            });
            
            this.menu.appendChild(item);
        });
    }

    selectOption(option) {
        this.selectedValue = option.id;
        this.searchInput.value = option.name;
        this.close();
        this.onChange && this.onChange(option);
    }

    handleKeydown(e) {
        if (!this.isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                this.open();
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredOptions.length - 1);
                this.updateHighlight();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateHighlight();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.filteredOptions[this.selectedIndex]) {
                    this.selectOption(this.filteredOptions[this.selectedIndex]);
                }
                break;
            case 'Escape':
                this.close();
                break;
        }
    }

    updateHighlight() {
        const items = this.menu.querySelectorAll('.dropdown-item');
        items.forEach((item, index) => {
            item.classList.remove('highlighted');
            if (index === this.selectedIndex) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    open() {
        this.isOpen = true;
        this.container.classList.add('open');
        this.renderOptions();
    }

    close() {
        this.isOpen = false;
        this.container.classList.remove('open');
        this.selectedIndex = -1;
    }

    getValue() {
        return this.selectedValue;
    }

    setValue(value) {
        const option = this.options.find(opt => opt.id === value);
        if (option) {
            this.selectedValue = value;
            this.searchInput.value = option.name;
        }
    }

    clear() {
        this.selectedValue = '';
        this.searchInput.value = '';
        this.close();
    }
}

class PromptManager {
    constructor() {
        this.prompts = [];
        this.userPrompts = [];
        this.promptSessions = [];
        this.currentCategory = 'writing';
        this.editingPromptId = null;
        this.editingUserPromptId = null;
        this.apiKey = localStorage.getItem('openrouter_api_key') || '';
        this.tavilyApiKey = localStorage.getItem('tavily_api_key') || '';
        this.perplexityApiKey = localStorage.getItem('perplexity_api_key') || '';
        this.availableModels = [];
        this.braveApiKey = localStorage.getItem('brave_api_key') || '';
        this.exaApiKey = localStorage.getItem('exa_api_key') || '';
        this.modelDropdowns = [];
        this.currentSessionId = null;
        this.internetAccessProvider = 'none';
        
        // Store generation IDs for cost lookup
        this.generationIds = new Map(); // slotNumber -> generationId
        
        // Chat-specific properties
        this.chatModelDropdown = null;
        this.selectedChatModel = null;
        this.chatInternetProvider = 'none';
        this.chatMessages = [];
        this.chatProvider = 'openrouter'; // 'openrouter' or 'ollama'
        this.ollamaStatus = 'unknown'; // 'online', 'offline', 'not_installed', 'checking'
        this.ollamaModels = [];
        this.chatSystemPromptCategory = 'writing'; // Current system prompt category for chat
        
        this.defaultPrompts = {
            writing: `You are an expert writer and editor. Your role is to help create high-quality, engaging, and well-structured content. 

Key guidelines:
- Write in a clear, concise, and engaging style
- Use proper grammar, punctuation, and sentence structure
- Adapt your tone to match the target audience
- Include relevant examples and evidence to support your points
- Structure content with clear headings, subheadings, and paragraphs
- Use active voice when possible
- Avoid jargon unless necessary and always define technical terms
- Ensure content flows logically from one point to the next
- Be original and avoid plagiarism
- Fact-check all claims and provide sources when appropriate

Always aim to create content that is informative, valuable, and enjoyable to read.`,

            seo: `You are an SEO expert and content strategist. Your role is to help create content that ranks well in search engines while providing genuine value to users.

Key guidelines:
- Research and incorporate relevant keywords naturally throughout the content
- Use keyword variations and long-tail keywords to capture more search intent
- Write compelling, click-worthy titles and meta descriptions
- Structure content with proper heading hierarchy (H1, H2, H3, etc.)
- Include internal and external links where appropriate
- Optimize for featured snippets by answering questions directly
- Use schema markup concepts in your content structure
- Focus on user intent and search query satisfaction
- Create content that's comprehensive and covers topics thoroughly
- Include relevant images, videos, and multimedia elements
- Write for both search engines and human readers
- Keep content fresh and up-to-date
- Use data and statistics to support claims
- Include clear calls-to-action where appropriate

Always prioritize user experience while implementing SEO best practices.`,

            coding: `You are an expert software developer and technical mentor. Your role is to help write clean, efficient, and maintainable code while explaining complex concepts clearly.

Key guidelines:
- Write clean, readable, and well-documented code
- Follow best practices and design patterns appropriate to the language/framework
- Use meaningful variable and function names
- Include proper error handling and edge case considerations
- Write code that is testable and modular
- Follow the DRY (Don't Repeat Yourself) principle
- Consider performance implications and optimization opportunities
- Include comments explaining complex logic or business rules
- Suggest improvements and alternative approaches when appropriate
- Explain the reasoning behind technical decisions
- Provide examples and code snippets that are ready to use
- Consider security implications and best practices
- Write code that is maintainable and scalable
- Follow language-specific conventions and style guides
- Include unit tests or testing strategies when relevant

Always aim to write code that is not just functional, but professional, maintainable, and educational.`,

            other: `You are a helpful AI assistant with expertise across multiple domains. Your role is to provide accurate, helpful, and well-structured responses to a wide variety of questions and tasks.

Key guidelines:
- Provide accurate and up-to-date information
- Be clear, concise, and well-organized in your responses
- Adapt your communication style to match the user's needs and expertise level
- Use examples and analogies to explain complex concepts
- Be honest about limitations and uncertainties
- Provide step-by-step instructions when appropriate
- Consider multiple perspectives and potential edge cases
- Suggest follow-up questions or additional resources when relevant
- Maintain a helpful and professional tone
- Structure responses with clear headings and bullet points when appropriate
- Cite sources when making specific claims
- Be respectful and inclusive in all interactions
- Focus on being genuinely helpful rather than just providing information

Always aim to be the most helpful and informative assistant possible while maintaining accuracy and clarity.`
        };
        
        this.init();
    }

    // Helper function to safely add event listeners
    safeAddEventListener(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with id '${elementId}' not found, skipping event listener`);
        }
    }

    async init() {
        this.setupEventListeners();
        this.initializeModelDropdowns();
        this.loadSystemPrompts(); // Load saved system prompts
        await this.loadPrompts();
        await this.loadUserPrompts();
        await this.loadAvailableModels();
        this.initPromptHistory(); // Initialize prompt history functionality
        this.updateUI();
        
        // Update chat dropdowns after everything is loaded
        this.updateChatSystemPromptDropdown();
        this.updateChatModelDropdown();
    }

    initializeModelDropdowns() {
        // Create searchable dropdowns for each model slot
        for (let i = 1; i <= 4; i++) {
            const dropdown = new SearchableDropdown(`dropdown-${i}`);
            dropdown.onChange = (option) => {
                console.log(`Model ${i} selected:`, option.name);
            };
            this.modelDropdowns.push(dropdown);
        }
        
        // Initialize chat dropdowns
        this.initializeChatDropdowns();
    }
    
    initializeChatDropdowns() {
        // Initialize model dropdown
        const chatModelElement = document.getElementById('chat-model-dropdown');
        if (chatModelElement) {
            this.chatModelDropdown = new SearchableDropdown('chat-model-dropdown');
            this.chatModelDropdown.onChange = (option) => {
                this.selectedChatModel = option;
                this.enableChatInterface();
                console.log('Chat model selected:', option.name);
            };
        }
        
        // Initialize provider dropdown
        const chatProviderElement = document.getElementById('chat-provider-dropdown');
        if (chatProviderElement) {
            this.chatProviderDropdown = new SearchableDropdown('chat-provider-dropdown');
            this.chatProviderDropdown.setOptions([
                { id: 'openrouter', name: 'OpenRouter' },
                { id: 'ollama', name: 'Ollama (Local)' }
            ]);
            this.chatProviderDropdown.setValue('openrouter');
            this.chatProviderDropdown.onChange = (option) => {
                this.chatProvider = option.id;
                this.onChatProviderChanged();
            };
        }
        
        // Initialize internet context dropdown
        const chatInternetElement = document.getElementById('chat-internet-dropdown');
        if (chatInternetElement) {
            this.chatInternetDropdown = new SearchableDropdown('chat-internet-dropdown');
            this.chatInternetDropdown.setOptions([
                { id: 'none', name: 'None' },
                { id: 'tavily', name: 'Tavily (External API)' },
                { id: 'openrouter', name: 'OpenRouter (Built-in Web Search)' }
            ]);
            this.chatInternetDropdown.setValue('none');
            this.chatInternetDropdown.onChange = (option) => {
                this.chatInternetProvider = option.id;
                this.updateChatProviderInfo();
            };
        }
        
        // Initialize system prompt dropdown
        const chatSystemPromptElement = document.getElementById('chat-system-prompt-dropdown');
        if (chatSystemPromptElement) {
            this.chatSystemPromptDropdown = new SearchableDropdown('chat-system-prompt-dropdown');
            this.chatSystemPromptDropdown.onChange = (option) => {
                this.chatSystemPromptCategory = option.id;
                this.updateChatSystemPromptPreview();
            };
            
            // Initialize with available prompts
            this.updateChatSystemPromptDropdown();
        }
    }

    handleTabClick(e) {
        // Handle clicks on child elements (icon, span) by finding the closest nav-btn
        const navBtn = e.target.closest('.nav-btn');
        const tabName = navBtn ? navBtn.dataset.tab : e.target.dataset.tab;
        if (tabName) {
            this.switchTab(tabName);
        }
    }

    setupEventListeners() {
        // Navigation - remove existing listeners first to prevent duplicates
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.removeEventListener('click', this.handleTabClick);
            btn.addEventListener('click', this.handleTabClick.bind(this));
        });

        // Add system prompt button
        document.getElementById('add-system-prompt-btn').addEventListener('click', () => {
            this.openAddSystemPromptModal();
        });

        // System prompt category selection
        document.getElementById('category-select').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.updateSystemPromptContent();
            // Also update the sidebar category selection
            document.querySelectorAll('.category-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            const sidebarBtn = document.querySelector(`[data-category="${e.target.value}"]`);
            if (sidebarBtn) {
                sidebarBtn.classList.add('active');
            }
        });

        // System prompt editing
        document.getElementById('edit-system-prompt-btn').addEventListener('click', () => {
            this.openSystemPromptEditor();
        });

        // System prompt content click to edit
        document.getElementById('system-prompt-content').addEventListener('click', () => {
            this.openSystemPromptEditor();
        });

        // Toggle system prompt expansion
        document.getElementById('toggle-prompt-expansion').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the edit modal
            this.togglePromptExpansion();
        });

        // System prompt modal controls
        document.getElementById('close-system-prompt-modal').addEventListener('click', () => {
            this.closeSystemPromptEditor();
        });

        document.getElementById('cancel-system-prompt').addEventListener('click', () => {
            this.closeSystemPromptEditor();
        });

        document.getElementById('save-system-prompt').addEventListener('click', () => {
            this.saveSystemPrompt();
        });

        // Prompt management
        this.safeAddEventListener('new-prompt-btn', 'click', () => {
            this.openPromptEditor();
        });

        this.safeAddEventListener('import-btn', 'click', () => {
            this.importPrompts();
        });

        this.safeAddEventListener('export-btn', 'click', () => {
            this.exportPrompts();
        });

        // User prompt management (buttons not currently in UI)
        // this.safeAddEventListener('new-user-prompt-btn', 'click', () => {
        //     this.openUserPromptEditor();
        // });

        // this.safeAddEventListener('import-user-prompts-btn', 'click', () => {
        //     this.importUserPrompts();
        // });

        // this.safeAddEventListener('export-user-prompts-btn', 'click', () => {
        //     this.exportUserPrompts();
        // });

        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closePromptEditor();
        });

        document.getElementById('cancel-prompt').addEventListener('click', () => {
            this.closePromptEditor();
        });

        document.getElementById('save-prompt').addEventListener('click', () => {
            this.savePrompt();
        });

        // User prompt modal controls
        document.getElementById('close-user-modal').addEventListener('click', () => {
            this.closeUserPromptEditor();
        });

        document.getElementById('cancel-user-prompt').addEventListener('click', () => {
            this.closeUserPromptEditor();
        });

        document.getElementById('save-user-prompt').addEventListener('click', () => {
            this.saveUserPrompt();
        });

        // Comparison
        document.getElementById('run-comparison-btn').addEventListener('click', () => {
            this.runComparison();
        });

        document.getElementById('clear-comparison-btn').addEventListener('click', () => {
            this.clearComparison();
        });

        // Settings
        document.getElementById('save-api-key').addEventListener('click', () => {
            this.saveApiKey();
        });

        document.getElementById('save-tavily-api-key').addEventListener('click', () => {
            this.saveTavilyApiKey();
        });

        document.getElementById('save-perplexity-api-key').addEventListener('click', () => {
            this.savePerplexityApiKey();
        });

        const braveBtn = document.getElementById('save-brave-api-key');
        if (braveBtn) braveBtn.addEventListener('click', () => this.saveBraveApiKey());

        const exaBtn = document.getElementById('save-exa-api-key');
        if (exaBtn) exaBtn.addEventListener('click', () => this.saveExaApiKey());

        // Perplexity Search
        document.getElementById('perplexity-search-btn').addEventListener('click', () => {
            this.performAeoComparison();
        });

        // Internet access dropdown
        document.getElementById('internet-access-select').addEventListener('change', (e) => {
            this.internetAccessProvider = e.target.value;
            this.updateProviderInfo();
        });
        
        // Ollama action button
        const ollamaActionBtn = document.getElementById('ollama-action-btn');
        if (ollamaActionBtn) {
            ollamaActionBtn.addEventListener('click', () => {
                this.handleOllamaAction();
            });
        }
        
        // Ollama refresh button
        const ollamaRefreshBtn = document.getElementById('ollama-refresh-btn');
        if (ollamaRefreshBtn) {
            ollamaRefreshBtn.addEventListener('click', () => {
                this.refreshOllamaModels();
            });
        }
        
        // Chat send button
        const chatSendBtn = document.getElementById('chat-send-btn');
        if (chatSendBtn) {
            chatSendBtn.addEventListener('click', () => {
                this.sendChatMessage();
            });
        }
        
        // Chat input enter key
        const chatInput = document.getElementById('chat-message-input');
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }
        
        
        // Chat system prompt view button
        const chatEditSystemPromptBtn = document.getElementById('chat-edit-system-prompt-btn');
        if (chatEditSystemPromptBtn) {
            chatEditSystemPromptBtn.addEventListener('click', () => {
                this.openChatSystemPromptModal();
            });
        }
        
        // Chat system prompt preview click
        const chatSystemPromptPreview = document.getElementById('chat-system-prompt-preview');
        if (chatSystemPromptPreview) {
            chatSystemPromptPreview.addEventListener('click', () => {
                this.openChatSystemPromptModal();
            });
        }

        // Add refresh models button if it exists
        const refreshModelsBtn = document.getElementById('refresh-models-btn');
        if (refreshModelsBtn) {
            refreshModelsBtn.addEventListener('click', () => {
                this.loadAvailableModels();
            });
        }

        // Close modal on outside click
        document.getElementById('prompt-editor-modal').addEventListener('click', (e) => {
            if (e.target.id === 'prompt-editor-modal') {
                this.closePromptEditor();
            }
        });

        document.getElementById('user-prompt-editor-modal').addEventListener('click', (e) => {
            if (e.target.id === 'user-prompt-editor-modal') {
                this.closeUserPromptEditor();
            }
        });

        // Add system prompt modal controls
        document.getElementById('close-add-system-prompt-modal').addEventListener('click', () => {
            this.closeAddSystemPromptModal();
        });

        document.getElementById('cancel-add-system-prompt').addEventListener('click', () => {
            this.closeAddSystemPromptModal();
        });

        document.getElementById('save-add-system-prompt').addEventListener('click', () => {
            this.saveNewSystemPrompt();
        });

        document.getElementById('add-system-prompt-modal').addEventListener('click', (e) => {
            if (e.target.id === 'add-system-prompt-modal') {
                this.closeAddSystemPromptModal();
            }
        });
    }

    switchTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const navBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
        }

        // Update comparison tab if switching to it
        if (tabName === 'comparison') {
            this.updateSystemPromptContent();
        }
        
        // Update user prompts grid if switching to prompts tab
        if (tabName === 'prompts') {
            this.updateUserPromptsGrid();
        }
        
        // Update system prompts grid if switching to system-prompts tab
        if (tabName === 'system-prompts') {
            this.updateSystemPromptsGrid();
        }
        
        // Update chat tab if switching to it
        if (tabName === 'chat') {
            this.updateChatUI();
            // Make sure dropdowns are properly initialized
            setTimeout(() => {
                this.updateChatSystemPromptDropdown();
                this.updateChatModelDropdown();
            }, 100);
        }
        
        // Update settings tab if switching to it
        if (tabName === 'settings') {
            this.loadSettingsValues();
        }
    }


    async loadPrompts() {
        try {
            const result = await ipcRenderer.invoke('load-prompts');
            if (result.success) {
                this.prompts = result.data || [];
            } else {
                console.error('Failed to load prompts:', result.error);
            }
        } catch (error) {
            console.error('Error loading prompts:', error);
        }
    }

    async loadUserPrompts() {
        try {
            const result = await ipcRenderer.invoke('load-user-prompts');
            if (result.success) {
                this.userPrompts = result.data || [];
            } else {
                console.error('Failed to load user prompts:', result.error);
            }
        } catch (error) {
            console.error('Error loading user prompts:', error);
        }
    }

    async savePrompts() {
        try {
            const result = await ipcRenderer.invoke('save-prompts', this.prompts);
            if (!result.success) {
                console.error('Failed to save prompts:', result.error);
            }
        } catch (error) {
            console.error('Error saving prompts:', error);
        }
    }

    async saveUserPrompts() {
        try {
            const result = await ipcRenderer.invoke('save-user-prompts', this.userPrompts);
            if (!result.success) {
                console.error('Failed to save user prompts:', result.error);
            }
        } catch (error) {
            console.error('Error saving user prompts:', error);
        }
    }

    updatePromptsGrid() {
        const grid = document.getElementById('prompts-grid');
        const filteredPrompts = this.currentCategory === 'all' 
            ? this.prompts 
            : this.prompts.filter(p => p.category === this.currentCategory);

        if (filteredPrompts.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                    <i class="fas fa-file-text" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3>No prompts found</h3>
                    <p>Create your first system prompt to get started.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filteredPrompts.map(prompt => `
            <div class="prompt-card" data-id="${prompt.id}">
                <div class="prompt-card-header">
                    <div>
                        <div class="prompt-title">${prompt.title}</div>
                        <span class="prompt-category">${prompt.category}</span>
                    </div>
                    <div class="prompt-actions">
                        <button class="action-btn" onclick="app.editPrompt('${prompt.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="app.deletePrompt('${prompt.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="prompt-content">${prompt.content}</div>
            </div>
        `).join('');
    }

    updateUserPromptsGrid() {
        const grid = document.getElementById('user-prompts-grid');
        if (!grid) {
            return;
        }
        
        // Show all user prompts
        const filteredPrompts = this.userPrompts;

        if (filteredPrompts.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                    <i class="fas fa-file-text" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3>No user prompts found</h3>
                    <p>Create your first user prompt to get started.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filteredPrompts.map(prompt => `
            <div class="prompt-card" data-id="${prompt.id}">
                <div class="prompt-card-header">
                    <div>
                        <div class="prompt-title">${prompt.title}</div>
                        <span class="prompt-category">${prompt.category}</span>
                        <span class="prompt-date">${new Date(prompt.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="prompt-actions">
                        <button class="action-btn" onclick="app.editUserPrompt('${prompt.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="app.deleteUserPrompt('${prompt.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="action-btn" onclick="app.usePromptInComparison('${prompt.id}')" title="Use in Comparison">
                            <i class="fas fa-balance-scale"></i>
                        </button>
                    </div>
                </div>
                <div class="prompt-content">${prompt.content}</div>
            </div>
        `).join('');
    }

    updateSystemPromptsGrid() {
        const grid = document.getElementById('prompts-grid');
        if (!grid) {
            return;
        }
        
        // Get all system prompts from defaultPrompts
        const systemPrompts = Object.keys(this.defaultPrompts).map(key => ({
            id: key,
            title: this.formatCategoryName(key),
            category: key,
            content: this.defaultPrompts[key],
            isDefault: true
        }));

        if (systemPrompts.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                    <i class="fas fa-cogs" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3>No system prompts found</h3>
                    <p>Create your first system prompt to get started.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = systemPrompts.map(prompt => `
            <div class="prompt-card system-prompt-card" data-id="${prompt.id}">
                <div class="prompt-card-header">
                    <div>
                        <div class="prompt-title">${prompt.title}</div>
                        <span class="prompt-category">${prompt.category}</span>
                        <span class="prompt-type">System Prompt</span>
                    </div>
                    <div class="prompt-actions">
                        <button class="action-btn" onclick="app.editSystemPrompt('${prompt.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="app.deleteSystemPrompt('${prompt.id}')" title="Delete" 
                                ${prompt.isDefault ? 'style="opacity: 0.5; cursor: not-allowed;" disabled' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="action-btn" onclick="app.useSystemPromptInComparison('${prompt.id}')" title="Use in Comparison">
                            <i class="fas fa-balance-scale"></i>
                        </button>
                    </div>
                </div>
                <div class="prompt-content system-prompt-content">${prompt.content}</div>
            </div>
        `).join('');
    }

    openPromptEditor(promptId = null) {
        this.editingPromptId = promptId;
        const modal = document.getElementById('prompt-editor-modal');
        const title = document.getElementById('modal-title');
        const promptTitle = document.getElementById('prompt-title');
        const promptCategory = document.getElementById('prompt-category');
        const promptContent = document.getElementById('prompt-content');

        if (promptId) {
            const prompt = this.prompts.find(p => p.id === promptId);
            title.textContent = 'Edit Prompt';
            promptTitle.value = prompt.title;
            promptCategory.value = prompt.category;
            promptContent.value = prompt.content;
        } else {
            title.textContent = 'New Prompt';
            promptTitle.value = '';
            promptCategory.value = 'seo';
            promptContent.value = '';
        }

        modal.classList.add('active');
        promptTitle.focus();
    }

    closePromptEditor() {
        document.getElementById('prompt-editor-modal').classList.remove('active');
        this.editingPromptId = null;
    }

    async savePrompt() {
        const title = document.getElementById('prompt-title').value.trim();
        const category = document.getElementById('prompt-category').value;
        const content = document.getElementById('prompt-content').value.trim();

        if (!title || !content) {
            alert('Please fill in both title and content.');
            return;
        }

        if (this.editingPromptId) {
            // Edit existing prompt
            const promptIndex = this.prompts.findIndex(p => p.id === this.editingPromptId);
            if (promptIndex !== -1) {
                this.prompts[promptIndex] = {
                    ...this.prompts[promptIndex],
                    title,
                    category,
                    content
                };
            }
        } else {
            // Create new prompt
            const newPrompt = {
                id: Date.now().toString(),
                title,
                category,
                content,
                createdAt: new Date().toISOString()
            };
            this.prompts.push(newPrompt);
        }

        await this.savePrompts();
        this.updatePromptsGrid();
        this.closePromptEditor();
    }

    editPrompt(promptId) {
        this.openPromptEditor(promptId);
    }

    async deletePrompt(promptId) {
        if (confirm('Are you sure you want to delete this prompt?')) {
            this.prompts = this.prompts.filter(p => p.id !== promptId);
            await this.savePrompts();
            this.updatePromptsGrid();
        }
    }

    async importPrompts() {
        try {
            const result = await ipcRenderer.invoke('import-prompts');
            if (result.success && !result.canceled) {
                this.prompts = result.data || [];
                await this.savePrompts();
                this.updatePromptsGrid();
                alert('Prompts imported successfully!');
            }
        } catch (error) {
            console.error('Error importing prompts:', error);
            alert('Failed to import prompts.');
        }
    }

    async exportPrompts() {
        try {
            const result = await ipcRenderer.invoke('export-prompts', this.prompts);
            if (result.success) {
                alert('Prompts exported successfully!');
            }
        } catch (error) {
            console.error('Error exporting prompts:', error);
            alert('Failed to export prompts.');
        }
    }

    // User prompt management methods
    openUserPromptEditor(promptId = null) {
        this.editingUserPromptId = promptId;
        const modal = document.getElementById('user-prompt-editor-modal');
        const title = document.getElementById('user-modal-title');
        const promptTitle = document.getElementById('user-prompt-title');
        const promptCategory = document.getElementById('user-prompt-category');
        const promptContent = document.getElementById('user-prompt-content');

        if (promptId) {
            const prompt = this.userPrompts.find(p => p.id === promptId);
            title.textContent = 'Edit User Prompt';
            promptTitle.value = prompt.title;
            promptCategory.value = prompt.category;
            promptContent.value = prompt.content;
        } else {
            title.textContent = 'New User Prompt';
            promptTitle.value = '';
            promptCategory.value = 'writing';
            promptContent.value = '';
        }

        modal.classList.add('active');
        promptTitle.focus();
    }

    closeUserPromptEditor() {
        document.getElementById('user-prompt-editor-modal').classList.remove('active');
        this.editingUserPromptId = null;
    }

    async saveUserPrompt() {
        const title = document.getElementById('user-prompt-title').value.trim();
        const category = document.getElementById('user-prompt-category').value;
        const content = document.getElementById('user-prompt-content').value.trim();

        if (!title || !content) {
            alert('Please fill in both title and content.');
            return;
        }

        if (this.editingUserPromptId) {
            // Edit existing prompt
            const promptIndex = this.userPrompts.findIndex(p => p.id === this.editingUserPromptId);
            if (promptIndex !== -1) {
                this.userPrompts[promptIndex] = {
                    ...this.userPrompts[promptIndex],
                    title,
                    category,
                    content
                };
            }
        } else {
            // Create new prompt
            const newPrompt = {
                id: Date.now().toString(),
                title,
                category,
                content,
                createdAt: new Date().toISOString()
            };
            this.userPrompts.push(newPrompt);
        }

        await this.saveUserPrompts();
        this.updateUserPromptsGrid();
        this.closeUserPromptEditor();
    }

    editUserPrompt(promptId) {
        this.openUserPromptEditor(promptId);
    }

    async deleteUserPrompt(promptId) {
        if (confirm('Are you sure you want to delete this user prompt?')) {
            this.userPrompts = this.userPrompts.filter(p => p.id !== promptId);
            await this.saveUserPrompts();
            this.updateUserPromptsGrid();
        }
    }

    usePromptInComparison(promptId) {
        const prompt = this.userPrompts.find(p => p.id === promptId);
        if (prompt) {
            // Switch to comparison tab
            this.switchTab('comparison');
            // Set the user message
            document.getElementById('user-message').value = prompt.content;
        }
    }

    editSystemPrompt(promptId) {
        // Set the current category to the one being edited
        this.currentCategory = promptId;
        document.getElementById('category-select').value = promptId;
        this.updateSystemPromptContent();
        
        // Switch to comparison tab to show the system prompt editor
        this.switchTab('comparison');
        
        // Open the system prompt editor
        this.openSystemPromptEditor();
    }

    deleteSystemPrompt(promptId) {
        // Don't allow deletion of default system prompts
        const defaultPrompts = ['writing', 'seo', 'coding', 'other'];
        if (defaultPrompts.includes(promptId)) {
            alert('Cannot delete default system prompts. You can only edit them.');
            return;
        }

        if (confirm(`Are you sure you want to delete the "${this.formatCategoryName(promptId)}" system prompt?`)) {
            delete this.defaultPrompts[promptId];
            this.saveSystemPromptsToStorage();
            this.updateSystemPromptsGrid();
            this.updateSystemPromptDropdown();
            
            // If we deleted the current category, switch to a default one
            if (this.currentCategory === promptId) {
                this.currentCategory = 'writing';
                document.getElementById('category-select').value = 'writing';
                this.updateSystemPromptContent();
            }
        }
    }

    useSystemPromptInComparison(promptId) {
        // Switch to comparison tab
        this.switchTab('comparison');
        
        // Set the current category to the selected system prompt
        this.currentCategory = promptId;
        document.getElementById('category-select').value = promptId;
        this.updateSystemPromptContent();
    }

    async importUserPrompts() {
        try {
            const result = await ipcRenderer.invoke('import-prompts');
            if (result.success && !result.canceled) {
                this.userPrompts = result.data || [];
                await this.saveUserPrompts();
                this.updateUserPromptsGrid();
                alert('User prompts imported successfully!');
            }
        } catch (error) {
            console.error('Error importing user prompts:', error);
            alert('Failed to import user prompts.');
        }
    }

    async exportUserPrompts() {
        try {
            const result = await ipcRenderer.invoke('export-prompts', this.userPrompts);
            if (result.success) {
                alert('User prompts exported successfully!');
            }
        } catch (error) {
            console.error('Error exporting user prompts:', error);
            alert('Failed to export user prompts.');
        }
    }

    async saveUserPromptFromComparison(userMessage) {
        // Check if this prompt already exists
        const existingPrompt = this.userPrompts.find(p => p.content === userMessage);
        if (existingPrompt) {
            return; // Don't save duplicates
        }

        // Create a new user prompt
        const newPrompt = {
            id: Date.now().toString(),
            title: `Prompt ${this.userPrompts.length + 1}`,
            category: this.currentCategory,
            content: userMessage,
            createdAt: new Date().toISOString()
        };

        this.userPrompts.push(newPrompt);
        await this.saveUserPrompts();
        
        // Update the user prompts grid if we're on the prompts tab
        if (document.getElementById('prompts-tab').classList.contains('active')) {
            this.updateUserPromptsGrid();
        }
    }


    async loadAvailableModels() {
        if (!this.apiKey) {
            console.log('No API key provided, models will not load');
            this.updateModelDropdowns();
            return;
        }

        try {
            console.log('Loading models from OpenRouter...');
            const response = await axios.get('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });

            this.availableModels = response.data.data || [];
            console.log(`Loaded ${this.availableModels.length} models from OpenRouter`);
            
            // Log the structure of the first model to understand the format
            if (this.availableModels.length > 0) {
                console.log('First model structure:', this.availableModels[0]);
                console.log('Model fields:', Object.keys(this.availableModels[0]));
            }
            
            // Transform models to ensure they have the right format for dropdowns
            this.availableModels = this.availableModels.map(model => ({
                id: model.id,
                name: model.name || model.id,
                description: model.description,
                ...model // keep other properties
            }));
            
            // Log some model names to see what we're getting
            console.log('Sample models:', this.availableModels.slice(0, 10).map(m => ({id: m.id, name: m.name})));
            
            
            this.updateModelsList();
            this.updateModelDropdowns();
        } catch (error) {
            console.error('Error loading models:', error);
            this.availableModels = [];
            this.updateModelDropdowns();
            
            // Show user-friendly error message
            if (error.code === 'ECONNABORTED') {
                alert('Request timeout while loading models. Please check your internet connection.');
            } else if (error.response?.status === 401) {
                alert('Invalid API key. Please check your OpenRouter API key in Settings.');
            } else {
                alert('Failed to load models. Please check your internet connection and API key.');
            }
        }
    }

    updateModelsList() {
        const modelsList = document.getElementById('models-list');
        
        if (this.availableModels.length === 0) {
            modelsList.innerHTML = '<p>No models available. Check your API key.</p>';
            return;
        }

        modelsList.innerHTML = this.availableModels.map(model => `
            <div class="model-item">
                <strong>${model.name}</strong>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                    ${model.description || 'No description available'}
                </div>
            </div>
        `).join('');
    }

    async runComparison() {
        console.log('Starting comparison...');
        const userMessageElement = document.getElementById('user-message');
        if (!userMessageElement) {
            console.error('User message element not found');
            return;
        }
        
        const userMessage = userMessageElement.value.trim();
        console.log('Current category:', this.currentCategory);
        console.log('Available prompt categories:', Object.keys(this.defaultPrompts));
        
        let systemPrompt = this.defaultPrompts[this.currentCategory];
        if (!systemPrompt) {
            console.warn(`No system prompt found for category: ${this.currentCategory}, using default`);
            systemPrompt = this.defaultPrompts.other || this.defaultPrompts.writing || 'You are a helpful assistant.';
        }
        
        console.log('User message:', userMessage);
        console.log('System prompt length:', systemPrompt ? systemPrompt.length : 0);

        if (!userMessage) {
            alert('Please enter a user message.');
            return;
        }

        if (!this.apiKey) {
            alert('Please configure your OpenRouter API key in Settings first.');
            return;
        }

        // Automatically save the user prompt
        await this.saveUserPromptFromComparison(userMessage);

        // Fetch internet context if using Tavily
        let internetContext = '';
        if (this.internetAccessProvider === 'tavily' && this.tavilyApiKey) {
            console.log('Fetching internet context with Tavily...');
            try {
                const context = await this.fetchInternetContext(userMessage);
                if (context) {
                    internetContext = this.formatInternetContext(context);
                    console.log('Tavily internet context added to prompt');
                } else {
                    // If search is enabled but failed, show error and stop
                    alert('Tavily internet search failed. Please check your API key or try again later.');
                    return;
                }
            } catch (error) {
                console.error('Tavily internet search error:', error);
                alert('Tavily internet search failed. Please check your API key or try again later.');
                return;
            }
        }

        // Get selected models from searchable dropdowns
        const selectedModels = [];
        this.modelDropdowns.forEach((dropdown, index) => {
            const value = dropdown.getValue();
            if (value) {
                const option = dropdown.options.find(opt => opt.id === value);
                if (option) {
                    selectedModels.push({
                        id: value,
                        name: option.name,
                        slot: index + 1
                    });
                }
            }
        });

        console.log('Selected models:', selectedModels);

        if (selectedModels.length === 0) {
            alert('Please select at least one model to compare.');
            return;
        }

        // Show loading state for selected models
        selectedModels.forEach(model => {
            this.showModelLoading(model.slot);
        });

        // Run API calls for each selected model
        for (const model of selectedModels) {
            let modelId = model.id;
            let finalUserMessage = userMessage + internetContext;
            
            // Handle OpenRouter web search by appending :online to model ID
            if (this.internetAccessProvider === 'openrouter') {
                modelId = model.id + ':online';
                finalUserMessage = userMessage; // Don't add Tavily context for OpenRouter search
                console.log(`Using OpenRouter web search with model: ${modelId}`);
            }
            
            await this.callLLM(modelId, model.name, systemPrompt, finalUserMessage, model.slot);
        }

        // Wait a bit for OpenRouter to process the generation data
        console.log('All LLM responses complete. Waiting 10 seconds before fetching cost data...');
        
        // Show cost loading indicator with countdown
        this.showCostLoadingIndicator(selectedModels);
        await this.countdownDelay(10000, selectedModels);

        // Now fetch cost information for all completed generations
        await this.batchFetchCostData(selectedModels);
        
        // Hide cost loading indicator
        this.hideCostLoadingIndicator(selectedModels);

        // Save prompt session after all API calls are complete
        this.savePromptSessionAfterComparison(systemPrompt, userMessage, selectedModels);
    }

    showModelLoading(slotNumber) {
        const output = document.getElementById(`output-${slotNumber}`);
        if (!output) {
            console.error(`Output element not found for slot ${slotNumber}`);
            return;
        }
        output.innerHTML = '<div class="loading-spinner">Loading... <span class="loading-time">0s</span></div>';
        output.classList.add('loading');
        
        // Start a timer to show elapsed time
        const startTime = Date.now();
        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const timeSpan = output.querySelector('.loading-time');
            if (timeSpan) {
                timeSpan.textContent = `${elapsed}s`;
            }
        }, 1000);
        
        // Store timer reference for cleanup
        output.dataset.timer = timer;
    }

    async callLLM(modelId, modelName, systemPrompt, userMessage, slotNumber) {
        try {
            console.log(`Calling LLM: ${modelName} (${modelId})`);
            console.log('API Key length:', this.apiKey ? this.apiKey.length : 0);
            
            // Calculate input tokens
            const inputText = `${systemPrompt}\n\n${userMessage}`;
            const inputTokens = this.estimateTokens(inputText);
            
            console.log(`Input tokens: ${inputTokens}, Model: ${modelId}`);
            console.log('Request payload:', {
                model: modelId,
                messages: [
                    { role: 'system', content: systemPrompt ? (systemPrompt.substring(0, 100) + '...') : 'No system prompt' },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });
            
            // Check if the model ID looks correct
            if (!modelId || typeof modelId !== 'string') {
                throw new Error(`Invalid model ID: ${modelId}`);
            }
            
            // Check if model ID looks like a proper OpenRouter format
            // Note: OpenRouter model IDs can contain colons for tier indicators (e.g., :free, :beta)
            // but should not contain spaces or other display name indicators
            if (modelId.includes(' ') || modelId.includes('Anthropic:') || modelId.includes('OpenAI:') || modelId.includes('Google:')) {
                console.warn('Model ID looks like a display name, not API ID:', modelId);
                throw new Error(`Model ID appears to be a display name rather than API ID: ${modelId}`);
            }
            
            console.log('Model ID validation passed:', modelId);
            
            const startTime = Date.now();
            console.log('Making API request...');
            
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: modelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 1000, // Reduced from 2000 for faster response
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            const endTime = Date.now();
            console.log(`API request completed in ${endTime - startTime}ms`);
            
            const content = response.data.choices[0].message.content;
            console.log(`Received response from ${modelName}, length: ${content.length}`);
            
            // Store generation ID for cost lookup
            const generationId = response.data.id;
            if (generationId) {
                this.generationIds.set(slotNumber, generationId);
                console.log(`Stored generation ID for slot ${slotNumber}: ${generationId}`);
            }
            
            // Try to get cost information - first from response usage, then from generation API
            let costInfo = null;
            
            // First, try to use usage data from the response if available
            if (response.data.usage) {
                const usage = response.data.usage;
                costInfo = {
                    inputTokens: usage.prompt_tokens || 0,
                    outputTokens: usage.completion_tokens || 0,
                    totalTokens: usage.total_tokens || 0,
                    // Note: We don't have cost from the response, so we'll show token counts
                    totalCost: 0, // Will be updated by generation API if available
                    inputCost: 0,
                    outputCost: 0
                };
                console.log('Using usage data from response:', costInfo);
            }
            
            // Add web search indicator if using OpenRouter web search
            let displayContent = content;
            if (modelId.includes(':online')) {
                displayContent = `🌐 Web Search Enabled\n\n${content}`;
            }
            
            // Update the output with initial cost info (tokens only)
            this.updateModelOutput(slotNumber, displayContent, costInfo);
        } catch (error) {
            console.error(`Error calling ${modelName}:`, error);
            let errorMessage = 'Unknown error occurred';
            
            if (error.code === 'ECONNABORTED') {
                errorMessage = 'Request timeout - the model took too long to respond';
            } else if (error.response?.data?.error?.message) {
                errorMessage = error.response.data.error.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.updateModelOutput(slotNumber, `Error: ${errorMessage}`);
        }
    }

    updateModelOutput(slotNumber, content, costInfo = null) {
        console.log(`Updating model output for slot ${slotNumber}`);
        const output = document.getElementById(`output-${slotNumber}`);
        const costDisplay = document.getElementById(`cost-${slotNumber}`);
        
        if (!output) {
            console.error(`Output element not found for slot ${slotNumber}`);
            return;
        }
        
        if (!costDisplay) {
            console.error(`Cost display element not found for slot ${slotNumber}`);
            return;
        }
        
        console.log(`Successfully found elements for slot ${slotNumber}`);
        
        // Clear the loading timer
        if (output.dataset.timer) {
            clearInterval(parseInt(output.dataset.timer));
            delete output.dataset.timer;
        }
        
        output.classList.remove('loading');
        
        // Update the content directly in the output area
        output.textContent = content;
        
        // Show or hide cost display below the textbox
        if (costInfo) {
            let costText;
            if (costInfo.totalCost > 0) {
                // We have actual cost information
                costText = `$${costInfo.totalCost.toFixed(6)} (${costInfo.inputTokens}→${costInfo.outputTokens} tokens)`;
                
                // Add additional info if available
                if (costInfo.latency) {
                    costText += ` [${costInfo.latency}ms]`;
                }
                if (costInfo.finishReason) {
                    costText += ` [${costInfo.finishReason}]`;
                }
            } else {
                // We only have token counts, no cost info yet
                costText = `${costInfo.inputTokens}→${costInfo.outputTokens} tokens (cost loading...)`;
            }
            costDisplay.textContent = costText;
            costDisplay.style.display = 'block';
        } else {
            costDisplay.style.display = 'none';
        }
    }

    // Countdown delay with visual feedback
    async countdownDelay(delayMs, selectedModels) {
        const totalSeconds = Math.ceil(delayMs / 1000);
        
        for (let i = totalSeconds; i > 0; i--) {
            selectedModels.forEach(model => {
                const costDisplay = document.getElementById(`cost-${model.slot}`);
                if (costDisplay) {
                    const currentText = costDisplay.textContent;
                    if (currentText && currentText.includes('(cost loading...)')) {
                        costDisplay.textContent = currentText.replace('(cost loading...)', `(waiting ${i}s...)`);
                    }
                }
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Show cost loading indicator for selected models
    showCostLoadingIndicator(selectedModels) {
        selectedModels.forEach(model => {
            const costDisplay = document.getElementById(`cost-${model.slot}`);
            if (costDisplay) {
                const currentText = costDisplay.textContent;
                if (currentText && !currentText.includes('fetching cost')) {
                    costDisplay.textContent = currentText.replace('(cost loading...)', '(fetching cost...)');
                }
            }
        });
    }

    // Hide cost loading indicator for selected models
    hideCostLoadingIndicator(selectedModels) {
        selectedModels.forEach(model => {
            const costDisplay = document.getElementById(`cost-${model.slot}`);
            if (costDisplay) {
                const currentText = costDisplay.textContent;
                if (currentText && currentText.includes('fetching cost')) {
                    costDisplay.textContent = currentText.replace('(fetching cost...)', '(cost loading...)');
                }
            }
        });
    }

    // Batch fetch cost data for all completed generations
    async batchFetchCostData(selectedModels) {
        console.log('Starting batch cost data fetch...');
        
        // Get all generation IDs that we have
        const costPromises = [];
        
        for (const model of selectedModels) {
            const generationId = this.generationIds.get(model.slot);
            if (generationId) {
                console.log(`Queuing cost lookup for slot ${model.slot} (${model.name}): ${generationId}`);
                costPromises.push(
                    this.getGenerationCostWithRetry(generationId, 8, 5000) // 8 retries, 5 second delay
                        .then(detailedCostInfo => {
                            if (detailedCostInfo) {
                                console.log(`Cost data received for slot ${model.slot}:`, detailedCostInfo);
                                this.updateCostDisplay(model.slot, detailedCostInfo);
                                return { slot: model.slot, costInfo: detailedCostInfo };
                            }
                            return null;
                        })
                        .catch(error => {
                            console.error(`Failed to get cost data for slot ${model.slot}:`, error);
                            return null;
                        })
                );
            } else {
                console.warn(`No generation ID found for slot ${model.slot} (${model.name})`);
            }
        }
        
        if (costPromises.length > 0) {
            console.log(`Waiting for ${costPromises.length} cost lookups to complete...`);
            const results = await Promise.allSettled(costPromises);
            
            const successful = results.filter(result => 
                result.status === 'fulfilled' && result.value !== null
            ).length;
            
            console.log(`Cost data fetch complete: ${successful}/${costPromises.length} successful`);
        } else {
            console.log('No generation IDs available for cost lookup');
        }
    }

    // Update only the cost display for a specific slot
    updateCostDisplay(slotNumber, costInfo) {
        const costDisplay = document.getElementById(`cost-${slotNumber}`);
        if (!costDisplay) {
            console.error(`Cost display element not found for slot ${slotNumber}`);
            return;
        }

        if (costInfo && costInfo.totalCost > 0) {
            let costText = `$${costInfo.totalCost.toFixed(6)} (${costInfo.inputTokens}→${costInfo.outputTokens} tokens)`;
            
            // Add additional info if available
            if (costInfo.latency) {
                costText += ` [${costInfo.latency}ms]`;
            }
            if (costInfo.finishReason) {
                costText += ` [${costInfo.finishReason}]`;
            }
            
            costDisplay.textContent = costText;
            costDisplay.style.display = 'block';
        }
    }

    clearComparison() {
        // Clear all model outputs
        for (let i = 1; i <= 4; i++) {
            const output = document.getElementById(`output-${i}`);
            const costDisplay = document.getElementById(`cost-${i}`);
            
            if (output) {
                output.classList.remove('loading');
                output.innerHTML = '<div class="output-placeholder">Model ' + i + ' output will appear here</div>';
            }
            
            if (costDisplay) {
                costDisplay.style.display = 'none';
            }
        }
        
        // Clear user message
        const userMessageElement = document.getElementById('user-message');
        if (userMessageElement) {
            userMessageElement.value = '';
        }
        
        // Clear all searchable dropdowns
        this.modelDropdowns.forEach(dropdown => {
            dropdown.clear();
        });
    }

    async saveApiKey() {
        const apiKey = document.getElementById('api-key').value.trim();
        if (!apiKey) {
            alert('Please enter an API key.');
            return;
        }

        this.apiKey = apiKey;
        localStorage.setItem('openrouter_api_key', apiKey);
        
        // Show loading message
        const saveBtn = document.getElementById('save-api-key');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Loading models...';
        saveBtn.disabled = true;
        
        try {
            await this.loadAvailableModels();
            alert('API key saved and models loaded successfully!');
        } catch (error) {
            alert('API key saved, but failed to load models. Please check your connection.');
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }

    async saveTavilyApiKey() {
        const apiKey = document.getElementById('tavily-api-key').value.trim();
        if (!apiKey) {
            alert('Please enter a Tavily API key.');
            return;
        }

        this.tavilyApiKey = apiKey;
        localStorage.setItem('tavily_api_key', apiKey);
        
        // Show success message
        const saveBtn = document.getElementById('save-tavily-api-key');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 1500);
    }

    async savePerplexityApiKey() {
        const apiKey = document.getElementById('perplexity-api-key').value.trim();
        if (!apiKey) {
            alert('Please enter a Perplexity API key.');
            return;
        }

        this.perplexityApiKey = apiKey;
        localStorage.setItem('perplexity_api_key', apiKey);
        
        // Show success message
        const saveBtn = document.getElementById('save-perplexity-api-key');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 1500);
    }

    async saveBraveApiKey() {
        const apiKey = document.getElementById('brave-api-key').value.trim();
        if (!apiKey) {
            alert('Please enter a Brave Search API key.');
            return;
        }
        this.braveApiKey = apiKey;
        localStorage.setItem('brave_api_key', apiKey);
        const saveBtn = document.getElementById('save-brave-api-key');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 1500);
    }

    async saveExaApiKey() {
        const apiKey = document.getElementById('exa-api-key').value.trim();
        if (!apiKey) {
            alert('Please enter an Exa API key.');
            return;
        }
        this.exaApiKey = apiKey;
        localStorage.setItem('exa_api_key', apiKey);
        const saveBtn = document.getElementById('save-exa-api-key');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 1500);
    }

    getSelectedProviders() {
        const container = document.getElementById('search-providers');
        if (!container) return ['perplexity'];
        const checked = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
            .map(i => i.value);
        return checked.length ? checked : ['perplexity'];
    }

    async performAeoComparison() {
        const query = document.getElementById('perplexity-query').value.trim();
        const country = document.getElementById('perplexity-country').value;
        if (!query) {
            alert('Please enter a search query.');
            return;
        }

        const providers = this.getSelectedProviders();
        const resultsSection = document.getElementById('perplexity-results-section');
        const resultsContainer = document.getElementById('perplexity-results');
        const resultsCount = document.getElementById('perplexity-results-count');
        resultsSection.style.display = 'block';
        resultsContainer.innerHTML = `
            <div class="search-loading">
                <i class="fas fa-spinner"></i>
                <p>Fetching results from: ${providers.join(', ')}</p>
            </div>
        `;

        const providerCalls = [];
        const warnings = [];
        
        if (providers.includes('perplexity')) {
            if (!this.perplexityApiKey) {
                warnings.push('Perplexity API key not configured');
                providerCalls.push(Promise.resolve({ provider: 'perplexity', results: [] }));
            } else {
                providerCalls.push(this.searchPerplexity(query, country));
            }
        } else {
            providerCalls.push(Promise.resolve({ provider: 'perplexity', results: [] }));
        }

        if (providers.includes('brave')) {
            if (!this.braveApiKey) {
                warnings.push('Brave API key not configured');
                providerCalls.push(Promise.resolve({ provider: 'brave', results: [] }));
            } else {
                providerCalls.push(this.searchBrave(query, country));
            }
        } else {
            providerCalls.push(Promise.resolve({ provider: 'brave', results: [] }));
        }

        if (providers.includes('tavily')) {
            if (!this.tavilyApiKey) {
                warnings.push('Tavily API key not configured');
                providerCalls.push(Promise.resolve({ provider: 'tavily', results: [] }));
            } else {
                providerCalls.push(this.searchTavily(query));
            }
        } else {
            providerCalls.push(Promise.resolve({ provider: 'tavily', results: [] }));
        }

        if (providers.includes('exa')) {
            if (!this.exaApiKey) {
                warnings.push('Exa API key not configured');
                providerCalls.push(Promise.resolve({ provider: 'exa', results: [] }));
            } else {
                providerCalls.push(this.searchExa(query));
            }
        } else {
            providerCalls.push(Promise.resolve({ provider: 'exa', results: [] }));
        }

        const providerResults = await Promise.all(providerCalls);
        
        // Add warning banner if some keys are missing
        let warningHtml = '';
        if (warnings.length > 0) {
            warningHtml = `
                <div class="search-warning" style="margin-bottom: 16px; padding: 12px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; color: #92400e;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Warning:</strong> ${warnings.join(', ')}. Results may be incomplete.
                </div>
            `;
        }
        
        resultsContainer.innerHTML = warningHtml;
        const tempDiv = document.createElement('div');
        resultsContainer.appendChild(tempDiv);
        this.renderAeoComparison(providerResults, tempDiv, resultsCount, providers);
    }

    async searchPerplexity(query, country) {
        try {
            const payload = {
                query,
                max_results: 10,
                max_tokens_per_page: 256
            };
            if (country && country !== 'worldwide') payload.country = country;
            const response = await axios.post('https://api.perplexity.ai/search', payload, {
                headers: { 'Authorization': `Bearer ${this.perplexityApiKey}`, 'Content-Type': 'application/json' }
            });
            const results = (response.data?.results || []).map((r, i) => ({ title: r.title, url: r.url, snippet: r.snippet || '', rank: i + 1 }));
            return { provider: 'perplexity', results };
        } catch (error) {
            console.error('Perplexity Search Error:', error.response?.data || error.message);
            return { provider: 'perplexity', results: [] };
        }
    }

    async searchBrave(query, country) {
        try {
            const params = new URLSearchParams({ q: query, count: '10' });
            if (country && country !== 'worldwide') {
                params.set('country', country.toLowerCase());
            }
            const resp = await axios.get(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
                headers: { 
                    'X-Subscription-Token': this.braveApiKey,
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip'
                }
            });
            const items = resp.data?.web?.results || [];
            const results = items.map((r, i) => ({ title: r.title, url: r.url, snippet: r.description || '', rank: i + 1 }));
            return { provider: 'brave', results };
        } catch (error) {
            console.error('Brave Search Error:', error.response?.data || error.message);
            // Return empty results instead of throwing to allow other providers to continue
            return { provider: 'brave', results: [] };
        }
    }

    async searchTavily(query) {
        try {
            const resp = await axios.post('https://api.tavily.com/search', {
                api_key: this.tavilyApiKey,
                query,
                search_depth: 'basic',
                include_answer: false,
                include_raw_content: false,
                max_results: 10
            }, { headers: { 'Content-Type': 'application/json' }});
            const items = resp.data?.results || [];
            const results = items.map((r, i) => ({ title: r.title, url: r.url, snippet: r.content || '', rank: i + 1 }));
            return { provider: 'tavily', results };
        } catch (error) {
            console.error('Tavily Search Error:', error.response?.data || error.message);
            return { provider: 'tavily', results: [] };
        }
    }

    async searchExa(query) {
        try {
            const resp = await axios.post('https://api.exa.ai/search', {
                query,
                numResults: 10
            }, { headers: { 'x-api-key': this.exaApiKey, 'Content-Type': 'application/json' }});
            const items = resp.data?.results || resp.data?.documents || [];
            const results = items.map((r, i) => ({ title: r.title || r.url, url: r.url, snippet: r.text || r.snippet || '', rank: i + 1 }));
            return { provider: 'exa', results };
        } catch (error) {
            console.error('Exa Search Error:', error.response?.data || error.message);
            return { provider: 'exa', results: [] };
        }
    }

    normalizeUrl(url) {
        if (!url) return '';
        try {
            // Parse the URL
            const urlObj = new URL(url);
            
            // Normalize: lowercase hostname, remove www, remove trailing slash, remove fragment
            let normalized = urlObj.protocol + '//' + 
                            urlObj.hostname.toLowerCase().replace(/^www\./, '') + 
                            urlObj.pathname.replace(/\/$/, '') + 
                            urlObj.search;
            
            return normalized;
        } catch (e) {
            // If URL parsing fails, return cleaned version
            return url.toLowerCase().replace(/\/$/, '').replace(/#.*$/, '');
        }
    }

    renderAeoComparison(providerResults, container, countElement, selected) {
        const providerMap = {};
        for (const pr of providerResults) providerMap[pr.provider] = pr.results;
        const urlSet = new Map(); // normalized url -> row object

        const addResults = (provider) => {
            const list = providerMap[provider] || [];
            list.forEach(item => {
                if (!item.url) return;
                
                const normalizedUrl = this.normalizeUrl(item.url);
                const key = normalizedUrl;
                
                if (!urlSet.has(key)) {
                    urlSet.set(key, {
                        title: item.title || item.url,
                        url: item.url, // Keep original URL for display
                        content: item.snippet || '',
                        perplexity: '❌', exa: '❌', brave: '❌', tavily: '❌'
                    });
                }
                const row = urlSet.get(key);
                row[provider] = item.rank;
                // Use content from the first selected provider present
                if (!row.content && item.snippet) row.content = item.snippet;
            });
        };

        ['perplexity','exa','brave','tavily'].forEach(addResults);

        const rows = Array.from(urlSet.values());
        countElement.textContent = `${rows.length} unique URLs`;

        const tableRows = rows.map(r => `
            <tr>
                <td class="result-title-cell"><a href="${r.url}" target="_blank">${this.escapeHtml(r.title)}</a></td>
                <td class="result-url-cell"><a href="${r.url}" target="_blank">${r.url}</a></td>
                <td class="rank-cell">${typeof r.perplexity === 'number' ? r.perplexity : '❌'}</td>
                <td class="rank-cell">${typeof r.exa === 'number' ? r.exa : '❌'}</td>
                <td class="rank-cell">${typeof r.brave === 'number' ? r.brave : '❌'}</td>
                <td class="rank-cell">${typeof r.tavily === 'number' ? r.tavily : '❌'}</td>
                <td class="result-snippet-cell"><div class="snippet-scroll">${this.escapeHtml(r.content || '')}</div></td>
            </tr>
        `).join('');

        const html = `
            <div class="results-table-wrapper">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>URL</th>
                            <th>Perplexity Rank</th>
                            <th>Exa Rank</th>
                            <th>Brave Rank</th>
                            <th>Tavily Rank</th>
                            <th>Content</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    }

    async performPerplexitySearch() {
        const query = document.getElementById('perplexity-query').value.trim();
        const country = document.getElementById('perplexity-country').value;
        
        if (!query) {
            alert('Please enter a search query.');
            return;
        }

        if (!this.perplexityApiKey) {
            alert('Please configure your Perplexity API key in Settings first.');
            return;
        }

        const resultsSection = document.getElementById('perplexity-results-section');
        const resultsContainer = document.getElementById('perplexity-results');
        const resultsCount = document.getElementById('perplexity-results-count');

        // Show loading state
        resultsSection.style.display = 'block';
        resultsContainer.innerHTML = `
            <div class="search-loading">
                <i class="fas fa-spinner"></i>
                <p>Searching...</p>
            </div>
        `;

        try {
            // Build the request payload
            const payload = {
                query: query,
                max_results: 10,
                max_tokens_per_page: 256
            };

            // Only add country if not worldwide
            if (country !== 'worldwide') {
                payload.country = country;
            }

            const response = await axios.post(
                'https://api.perplexity.ai/search',
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Display results
            this.displayPerplexityResults(response.data.results, resultsContainer, resultsCount);
        } catch (error) {
            console.error('Perplexity Search Error:', error);
            resultsContainer.innerHTML = `
                <div class="search-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <div>
                        <strong>Search Error</strong>
                        <p>${error.response?.data?.message || error.message || 'Failed to perform search. Please check your API key and try again.'}</p>
                    </div>
                </div>
            `;
        }
    }

    displayPerplexityResults(results, container, countElement) {
        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="search-error">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <strong>No Results</strong>
                        <p>No search results found. Try a different query.</p>
                    </div>
                </div>
            `;
            countElement.textContent = '0 results';
            return;
        }

        countElement.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;

        const tableRows = results.map((result, index) => {
            const snippet = result.snippet || 'No preview available';
            const title = result.title || 'Untitled';
            const url = result.url || '';

            return `
                <tr>
                    <td class="result-number-cell">${index + 1}</td>
                    <td class="result-title-cell">
                        <a href="${url}" target="_blank" title="${this.escapeHtml(title)}">${this.escapeHtml(title)}</a>
                    </td>
                    <td class="result-url-cell">
                        <a href="${url}" target="_blank" title="${url}">${url}</a>
                    </td>
                    <td class="result-snippet-cell"><div class="snippet-scroll">${this.escapeHtml(snippet)}</div></td>
                </tr>
            `;
        }).join('');

        const tableHTML = `
            <div class="results-table-wrapper">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Title</th>
                            <th>URL</th>
                            <th>Content</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    loadSettingsValues() {
        // Load API keys from localStorage and populate the input fields
        const apiKeyInput = document.getElementById('api-key');
        const tavilyApiKeyInput = document.getElementById('tavily-api-key');
        const perplexityApiKeyInput = document.getElementById('perplexity-api-key');
        const braveApiKeyInput = document.getElementById('brave-api-key');
        const exaApiKeyInput = document.getElementById('exa-api-key');

        if (apiKeyInput && this.apiKey) {
            apiKeyInput.value = this.apiKey;
        }
        if (tavilyApiKeyInput && this.tavilyApiKey) {
            tavilyApiKeyInput.value = this.tavilyApiKey;
        }
        if (perplexityApiKeyInput && this.perplexityApiKey) {
            perplexityApiKeyInput.value = this.perplexityApiKey;
        }
        if (braveApiKeyInput && this.braveApiKey) {
            braveApiKeyInput.value = this.braveApiKey;
        }
        if (exaApiKeyInput && this.exaApiKey) {
            exaApiKeyInput.value = this.exaApiKey;
        }
    }

    async fetchInternetContext(query) {
        if (this.internetAccessProvider !== 'tavily' || !this.tavilyApiKey) {
            return null;
        }

        try {
            console.log('Fetching internet context for query:', query);
            
            // Step 1: Search for relevant URLs using advanced search
            const searchResponse = await axios.post('https://api.tavily.com/search', {
                api_key: this.tavilyApiKey,
                query: query,
                search_depth: "advanced",
                include_answer: true,
                include_raw_content: false,
                max_results: 10
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            if (!searchResponse.data || !searchResponse.data.results) {
                return null;
            }

            // Filter URLs with score > 0.5 for relevance
            const relevantUrls = searchResponse.data.results
                .filter(result => result.score > 0.5)
                .slice(0, 3) // Limit to top 3 most relevant URLs
                .map(result => result.url);

            if (relevantUrls.length === 0) {
                console.log('No relevant URLs found with score > 0.5');
                return null;
            }

            console.log('Found relevant URLs:', relevantUrls);

            // Step 2: Extract content from the most relevant URLs
            const extractPromises = relevantUrls.map(url => 
                this.extractContentFromUrl(url)
            );

            const extractedContents = await Promise.all(extractPromises);
            
            // Filter out failed extractions and combine with search results
            const context = [];
            for (let i = 0; i < relevantUrls.length; i++) {
                const searchResult = searchResponse.data.results.find(r => r.url === relevantUrls[i]);
                const extractedContent = extractedContents[i];
                
                if (searchResult && extractedContent) {
                    context.push({
                        title: searchResult.title,
                        content: extractedContent.content || searchResult.content,
                        url: searchResult.url,
                        score: searchResult.score
                    });
                }
            }

            console.log('Internet context extracted:', context);
            return context;

        } catch (error) {
            console.error('Error fetching internet context:', error);
            
            // Provide more specific error information
            if (error.response?.status === 400) {
                console.error('Tavily API Error 400: Bad Request - Check your API key and request format');
            } else if (error.response?.status === 401) {
                console.error('Tavily API Error 401: Unauthorized - Invalid API key');
            } else if (error.response?.status === 429) {
                console.error('Tavily API Error 429: Rate limit exceeded');
            } else if (error.code === 'ECONNABORTED') {
                console.error('Tavily API timeout - Request took too long');
            }
            
            // Re-throw the error so the calling code can handle it
            throw error;
        }
    }

    async extractContentFromUrl(url) {
        try {
            const response = await axios.post('https://api.tavily.com/extract', {
                api_key: this.tavilyApiKey,
                urls: [url],
                extract_depth: "advanced"
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && response.data.results && response.data.results.length > 0) {
                return response.data.results[0];
            }
        } catch (error) {
            console.error(`Error extracting content from ${url}:`, error);
        }
        return null;
    }

    formatInternetContext(context) {
        if (!context || context.length === 0) {
            return '';
        }

        let formattedContext = '\n\n--- Internet Context ---\n';
        context.forEach((item, index) => {
            formattedContext += `\n${index + 1}. ${item.title}\n`;
            formattedContext += `   ${item.content}\n`;
            formattedContext += `   Source: ${item.url}\n`;
            if (item.score) {
                formattedContext += `   Relevance Score: ${item.score.toFixed(2)}\n`;
            }
        });
        formattedContext += '\n--- End Internet Context ---\n';

        return formattedContext;
    }

    updateUI() {
        this.updatePromptsGrid();
        this.updateUserPromptsGrid();
        this.updateSystemPromptsGrid();
        this.updateSystemPromptDropdown();
        this.updateSystemPromptContent();
        this.updateModelDropdowns();
        this.updateProviderInfo();
        
        // Load API keys if available
        if (this.apiKey) {
            document.getElementById('api-key').value = this.apiKey;
        }
        if (this.tavilyApiKey) {
            document.getElementById('tavily-api-key').value = this.tavilyApiKey;
        }
    }

    updateProviderInfo() {
        const providerInfo = document.getElementById('provider-info');
        const providerInfoContent = document.getElementById('provider-info-content');
        
        if (!providerInfo || !providerInfoContent) {
            return;
        }

        // Remove existing classes
        providerInfo.classList.remove('tavily', 'openrouter');

        switch (this.internetAccessProvider) {
            case 'tavily':
                providerInfo.classList.add('tavily');
                providerInfoContent.innerHTML = `
                    <strong>Tavily Search:</strong> External search API that provides up-to-date web results.<br>
                    • Requires separate Tavily API key<br>
                    • Advanced search with content extraction<br>
                    • Results are pre-processed and added to your prompt
                `;
                providerInfo.style.display = 'block';
                break;
                
            case 'openrouter':
                providerInfo.classList.add('openrouter');
                providerInfoContent.innerHTML = `
                    <strong>OpenRouter Web Search:</strong> Built-in web search using Exa.ai integration.<br>
                    • Uses your existing OpenRouter API key<br>
                    • Fetches up to 5 web results per request<br>
                    • <strong>Cost:</strong> $4 per 1,000 web results (added to model costs)<br>
                    • Results automatically integrated into model responses
                `;
                providerInfo.style.display = 'block';
                break;
                
            case 'none':
            default:
                providerInfo.style.display = 'none';
                break;
        }
    }

    updateSystemPromptContent() {
        const content = document.getElementById('system-prompt-content');
        content.textContent = this.defaultPrompts[this.currentCategory] || this.defaultPrompts.other;
        
        // Start in collapsed state
        content.classList.add('collapsed');
        this.updateToggleButton(false);
    }

    togglePromptExpansion() {
        const content = document.getElementById('system-prompt-content');
        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
            content.classList.remove('collapsed');
            this.updateToggleButton(true);
        } else {
            content.classList.add('collapsed');
            this.updateToggleButton(false);
        }
    }

    updateToggleButton(isExpanded) {
        const toggleBtn = document.getElementById('toggle-prompt-expansion');
        const icon = toggleBtn.querySelector('i');
        const text = toggleBtn.querySelector('span') || toggleBtn.childNodes[2];
        
        if (isExpanded) {
            icon.className = 'fas fa-chevron-up';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Show less';
            toggleBtn.classList.add('expanded');
        } else {
            icon.className = 'fas fa-chevron-down';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Show more';
            toggleBtn.classList.remove('expanded');
        }
    }

    openSystemPromptEditor() {
        const modal = document.getElementById('system-prompt-modal');
        const textarea = document.getElementById('system-prompt-textarea');
        const categoryName = document.getElementById('modal-category-name');
        
        // Update category name in modal
        const categoryNames = {
            'writing': 'Writing',
            'seo': 'SEO', 
            'coding': 'Coding',
            'other': 'Other'
        };
        categoryName.textContent = categoryNames[this.currentCategory] || 'Other';
        
        // Load current content
        textarea.value = this.defaultPrompts[this.currentCategory] || this.defaultPrompts.other;
        
        // Show modal
        modal.style.display = 'block';
        textarea.focus();
    }

    closeSystemPromptEditor() {
        const modal = document.getElementById('system-prompt-modal');
        modal.style.display = 'none';
    }

    saveSystemPrompt() {
        const textarea = document.getElementById('system-prompt-textarea');
        const newContent = textarea.value.trim();
        
        if (newContent) {
            this.defaultPrompts[this.currentCategory] = newContent;
            this.saveSystemPromptsToStorage(); // Save to localStorage
            this.updateSystemPromptContent();
            this.closeSystemPromptEditor();
        } else {
            alert('Please enter a system prompt.');
        }
    }

    loadSystemPrompts() {
        try {
            const savedPrompts = localStorage.getItem('system_prompts');
            if (savedPrompts) {
                const parsedPrompts = JSON.parse(savedPrompts);
                // Merge saved prompts with defaults, keeping defaults for any missing categories
                this.defaultPrompts = { ...this.defaultPrompts, ...parsedPrompts };
                console.log('Loaded saved system prompts:', parsedPrompts);
            }
        } catch (error) {
            console.error('Error loading system prompts:', error);
        }
    }

    saveSystemPromptsToStorage() {
        try {
            localStorage.setItem('system_prompts', JSON.stringify(this.defaultPrompts));
            console.log('Saved system prompts to localStorage');
            // Show a brief success indicator
            this.showSaveIndicator();
        } catch (error) {
            console.error('Error saving system prompts:', error);
        }
    }

    showSaveIndicator() {
        const saveBtn = document.getElementById('save-system-prompt');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 1500);
    }

    openAddSystemPromptModal() {
        const modal = document.getElementById('add-system-prompt-modal');
        document.getElementById('new-system-prompt-category').value = '';
        document.getElementById('new-system-prompt-content').value = '';
        modal.style.display = 'block';
        document.getElementById('new-system-prompt-category').focus();
    }

    closeAddSystemPromptModal() {
        const modal = document.getElementById('add-system-prompt-modal');
        modal.style.display = 'none';
    }

    async saveNewSystemPrompt() {
        const categoryInput = document.getElementById('new-system-prompt-category');
        const contentTextarea = document.getElementById('new-system-prompt-content');
        
        const category = categoryInput.value.trim().toLowerCase();
        const content = contentTextarea.value.trim();

        if (!category || !content) {
            alert('Please fill in both category name and prompt content.');
            return;
        }

        // Convert category to a valid key (remove spaces, special chars)
        const categoryKey = category.replace(/[^a-z0-9]/g, '-');

        // Add the new prompt to defaultPrompts
        this.defaultPrompts[categoryKey] = content;
        
        // Save to localStorage
        this.saveSystemPromptsToStorage();

        // Add new option to dropdown
        this.updateSystemPromptDropdown();

        // Set as current category
        this.currentCategory = categoryKey;
        document.getElementById('category-select').value = categoryKey;
        this.updateSystemPromptContent();

        // Close modal
        this.closeAddSystemPromptModal();

        alert(`System prompt for "${category}" has been added successfully!`);
    }

    updateSystemPromptDropdown() {
        const select = document.getElementById('category-select');
        
        // Clear existing options
        select.innerHTML = '';
        
        // Add all available prompts as options
        Object.keys(this.defaultPrompts).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = this.formatCategoryName(key);
            select.appendChild(option);
        });
    }

    formatCategoryName(key) {
        // Convert key back to display name
        return key.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    resetSystemPromptsToDefaults() {
        if (confirm('Are you sure you want to reset all system prompts to their default values? This cannot be undone.')) {
            // Reset to original defaults
            this.defaultPrompts = {
                writing: `You are an expert writer and editor. Your role is to help create high-quality, engaging, and well-structured content. 

Key guidelines:
- Write in a clear, concise, and engaging style
- Use proper grammar, punctuation, and sentence structure
- Adapt your tone and style to match the target audience
- Ensure content is original, informative, and valuable
- Structure content with clear headings, subheadings, and logical flow
- Use active voice when possible for better readability
- Include relevant examples and evidence to support your points
- Optimize for readability with appropriate paragraph lengths and bullet points
- Always fact-check and verify information before including it
- End with a clear call-to-action when appropriate

Please provide content that is well-researched, engaging, and tailored to the specific requirements provided.`,

                seo: `You are an expert SEO content strategist and writer. Your role is to create content that ranks well in search engines while providing genuine value to users.

Key guidelines:
- Research and incorporate relevant keywords naturally throughout the content
- Create compelling, click-worthy titles and meta descriptions
- Structure content with proper heading hierarchy (H1, H2, H3, etc.)
- Write for featured snippets and voice search optimization
- Include internal and external links where appropriate
- Optimize for user intent and search queries
- Create content that answers specific questions users are asking
- Use schema markup opportunities when relevant
- Ensure content is mobile-friendly and loads quickly
- Focus on E-A-T (Expertise, Authoritativeness, Trustworthiness)
- Create evergreen content that remains relevant over time
- Include clear calls-to-action to improve user engagement

Please create SEO-optimized content that provides real value while ranking well in search results.`,

                coding: `You are an expert software developer and technical writer. Your role is to help with coding tasks, code reviews, debugging, and technical documentation.

Key guidelines:
- Write clean, readable, and maintainable code
- Follow best practices and coding standards for the specific language/framework
- Include proper comments and documentation
- Consider performance, security, and scalability
- Use meaningful variable and function names
- Follow DRY (Don't Repeat Yourself) principles
- Write modular, testable code
- Include error handling and edge cases
- Provide clear explanations for complex logic
- Suggest improvements and optimizations
- Consider different approaches and trade-offs
- Include code examples and snippets when helpful
- Explain the reasoning behind technical decisions

Please provide high-quality code solutions with clear explanations and best practices.`,

                other: `You are a helpful AI assistant. Please provide accurate, helpful, and well-structured responses to the user's requests.

Key guidelines:
- Be clear, concise, and informative
- Provide accurate information and cite sources when appropriate
- Structure your responses logically with clear headings when needed
- Use examples to illustrate complex concepts
- Ask clarifying questions when the request is ambiguous
- Be honest about limitations or uncertainties
- Adapt your communication style to the user's needs
- Provide actionable advice when possible
- Maintain a helpful and professional tone

Please provide a helpful and well-structured response to the user's request.`
            };
            
            this.saveSystemPromptsToStorage();
            this.updateSystemPromptContent();
            alert('System prompts have been reset to default values.');
        }
    }

    updateModelDropdowns() {
        if (this.availableModels.length > 0) {
            // Sort models by popularity/name but don't limit the number
            // Since we have search functionality, we can show all models
            const sortedModels = this.availableModels
                .sort((a, b) => {
                    // Prioritize popular models
                    const aPopular = a.name.toLowerCase().includes('gpt') || 
                                   a.name.toLowerCase().includes('claude') || 
                                   a.name.toLowerCase().includes('llama') ||
                                   a.name.toLowerCase().includes('gemini');
                    const bPopular = b.name.toLowerCase().includes('gpt') || 
                                   b.name.toLowerCase().includes('claude') || 
                                   b.name.toLowerCase().includes('llama') ||
                                   b.name.toLowerCase().includes('gemini');
                    
                    if (aPopular && !bPopular) return -1;
                    if (!aPopular && bPopular) return 1;
                    return a.name.localeCompare(b.name);
                });

            console.log(`Setting ${sortedModels.length} models in dropdowns`);
            console.log('First model sample:', sortedModels[0]);
            
            // Update all comparison dropdowns with all available models
            this.modelDropdowns.forEach(dropdown => {
                dropdown.setOptions(sortedModels);
            });
            
            // Also update the chat model dropdown if it exists and we're using OpenRouter
            this.updateChatModelDropdown();
        } else {
            // Show empty state for all dropdowns
            this.modelDropdowns.forEach(dropdown => {
                dropdown.setOptions([]);
            });
            
            // Also clear the chat model dropdown
            this.updateChatModelDropdown();
        }
    }

    // Simple token estimation (rough approximation)
    estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters for English text
        // This is a simplified approach - in production, use proper tokenizers
        return Math.ceil(text.length / 4);
    }

    // Get accurate cost information from OpenRouter Generation API with retry
    async getGenerationCostWithRetry(generationId, maxRetries = 8, delayMs = 5000) {
        if (!generationId) {
            console.warn('No generation ID provided for cost lookup');
            return null;
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Fetching cost info for generation: ${generationId} (attempt ${attempt}/${maxRetries})`);
                console.log(`API URL: https://openrouter.ai/api/v1/generation?id=${generationId}`);
                
                const response = await axios.get(`https://openrouter.ai/api/v1/generation?id=${generationId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000 // 15 second timeout
                });

                const generationData = response.data;
                console.log(`Generation data for ${generationId}:`, generationData);
                console.log(`Response status: ${response.status}`);

                // Extract cost and token information from OpenRouter Generation API structure
                if (generationData.data) {
                    const data = generationData.data;
                    const inputTokens = data.tokens_prompt || 0;
                    const outputTokens = data.tokens_completion || 0;
                    const totalTokens = inputTokens + outputTokens;
                    const totalCost = data.total_cost || 0;
                    const usage = data.usage || 0; // Additional usage field
                    
                    console.log(`Parsed data: input=${inputTokens}, output=${outputTokens}, total=${totalTokens}, cost=${totalCost}, usage=${usage}`);
                    console.log(`Model: ${data.model}, Created: ${data.created_at}`);
                    
                    return {
                        inputTokens: inputTokens,
                        outputTokens: outputTokens,
                        totalTokens: totalTokens,
                        totalCost: totalCost,
                        usage: usage, // Additional usage information
                        inputCost: totalCost > 0 && totalTokens > 0 ? (totalCost * (inputTokens / totalTokens)) : 0,
                        outputCost: totalCost > 0 && totalTokens > 0 ? (totalCost * (outputTokens / totalTokens)) : 0,
                        // Additional metadata
                        model: data.model,
                        createdAt: data.created_at,
                        latency: data.latency,
                        finishReason: data.finish_reason
                    };
                } else {
                    console.warn('No data object found in generation response');
                    console.log('Available fields:', Object.keys(generationData));
                    return null;
                }
            } catch (error) {
                console.error(`Error fetching generation cost (attempt ${attempt}/${maxRetries}):`, error);
                console.error(`Error details:`, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    message: error.message
                });
                
                if (attempt === maxRetries) {
                    console.warn(`Max retries reached for generation ${generationId}, giving up on cost lookup`);
                    return null;
                }
                
                // Wait before retrying
                console.log(`Waiting ${delayMs}ms before retry ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
        return null;
    }

    // Prompt Session Management
    async savePromptSession(systemPrompt, userPrompt, responses) {
        try {
            const sessionData = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                systemPrompt: systemPrompt,
                userPrompt: userPrompt,
                responses: responses,
                models: responses.map(r => r.model)
            };

            const result = await ipcRenderer.invoke('save-prompt-session', sessionData);
            if (result.success) {
                console.log('Prompt session saved successfully');
                this.loadPromptHistory(); // Refresh the history
            } else {
                console.error('Failed to save prompt session:', result.error);
            }
        } catch (error) {
            console.error('Error saving prompt session:', error);
        }
    }

    async loadPromptHistory() {
        try {
            const result = await ipcRenderer.invoke('load-prompt-sessions');
            if (result.success) {
                this.promptSessions = result.data || [];
                this.renderPromptHistory();
            } else {
                console.error('Failed to load prompt sessions:', result.error);
            }
        } catch (error) {
            console.error('Error loading prompt sessions:', error);
        }
    }

    renderPromptHistory() {
        const historyList = document.getElementById('prompt-history-list');
        if (!historyList) return;

        if (this.promptSessions.length === 0) {
            historyList.innerHTML = `
                <div class="prompt-history-empty">
                    <i class="fas fa-history"></i>
                    <h4>No Previous Prompts</h4>
                    <p>Run some comparisons to see your prompt history here</p>
                </div>
            `;
            return;
        }

        // Sort sessions by timestamp (newest first)
        const sortedSessions = this.promptSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        historyList.innerHTML = sortedSessions.map(session => {
            const date = new Date(session.timestamp).toLocaleDateString();
            const time = new Date(session.timestamp).toLocaleTimeString();
            const modelsText = session.models.join(', ');
            const preview = session.userPrompt.length > 100 
                ? session.userPrompt.substring(0, 100) + '...' 
                : session.userPrompt;

            return `
                <div class="prompt-history-item" data-session-id="${session.id}">
                    <div class="prompt-history-item-header">
                        <h4 class="prompt-history-title">${preview}</h4>
                        <div class="prompt-history-meta">
                            <div class="prompt-history-date">${date} ${time}</div>
                            <div class="prompt-history-models">${modelsText}</div>
                        </div>
                    </div>
                    <p class="prompt-history-preview">${preview}</p>
                    <div class="prompt-history-item-actions">
                        <button class="prompt-history-delete-btn" onclick="event.stopPropagation(); window.app.deletePromptSession('${session.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        historyList.querySelectorAll('.prompt-history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.prompt-history-delete-btn')) {
                    const sessionId = item.dataset.sessionId;
                    this.showPromptSessionDetail(sessionId);
                }
            });
        });
    }

    showPromptSessionDetail(sessionId) {
        const session = this.promptSessions.find(s => s.id === sessionId);
        if (!session) return;

        // Update modal content
        document.getElementById('session-date').textContent = new Date(session.timestamp).toLocaleString();
        document.getElementById('session-models').textContent = session.models.join(', ');
        document.getElementById('session-system-prompt').textContent = session.systemPrompt;
        document.getElementById('session-user-prompt').textContent = session.userPrompt;

        // Render responses
        const responsesContainer = document.getElementById('session-responses');
        responsesContainer.innerHTML = session.responses.map(response => `
            <div class="response-item">
                <div class="response-header">
                    <span class="response-model">${response.model}</span>
                    <span class="response-cost">$${response.cost?.totalCost?.toFixed(4) || 'N/A'}</span>
                </div>
                <div class="response-content">${response.content}</div>
            </div>
        `).join('');

        // Store current session ID for deletion
        this.currentSessionId = sessionId;

        // Show modal
        document.getElementById('prompt-session-modal').style.display = 'flex';
    }

    async deletePromptSession(sessionId) {
        if (!confirm('Are you sure you want to delete this prompt session?')) {
            return;
        }

        try {
            const result = await ipcRenderer.invoke('delete-prompt-session', sessionId);
            if (result.success) {
                console.log('Prompt session deleted successfully');
                this.loadPromptHistory(); // Refresh the history
            } else {
                console.error('Failed to delete prompt session:', result.error);
            }
        } catch (error) {
            console.error('Error deleting prompt session:', error);
        }
    }

    searchPromptHistory(searchTerm) {
        const historyItems = document.querySelectorAll('.prompt-history-item');
        const term = searchTerm.toLowerCase();

        historyItems.forEach(item => {
            const title = item.querySelector('.prompt-history-title').textContent.toLowerCase();
            const preview = item.querySelector('.prompt-history-preview').textContent.toLowerCase();
            const models = item.querySelector('.prompt-history-models').textContent.toLowerCase();
            
            // Get the session ID to find the corresponding session data
            const sessionId = item.dataset.sessionId;
            const session = this.promptSessions.find(s => s.id === sessionId);
            
            // Search in responses content
            let responseMatches = false;
            if (session && session.responses) {
                responseMatches = session.responses.some(response => 
                    response.content.toLowerCase().includes(term)
                );
            }
            
            const matches = title.includes(term) || preview.includes(term) || models.includes(term) || responseMatches;
            item.style.display = matches ? 'block' : 'none';
        });
    }

    // Save prompt session after comparison is complete
    async savePromptSessionAfterComparison(systemPrompt, userPrompt, selectedModels) {
        try {
            // Collect responses from all model outputs
            const responses = [];
            
            for (const model of selectedModels) {
                const outputElement = document.getElementById(`output-${model.slot}`);
                if (outputElement && !outputElement.classList.contains('loading')) {
                    const content = outputElement.textContent || outputElement.innerText || '';
                    const costElement = document.getElementById(`cost-${model.slot}`);
                    let cost = null;
                    
                    if (costElement && costElement.textContent && costElement.textContent !== '') {
                        const costText = costElement.textContent;
                        const costMatch = costText.match(/\$([\d.]+)/);
                        if (costMatch) {
                            cost = { totalCost: parseFloat(costMatch[1]) };
                        }
                    }
                    
                    // Only save if we have actual content (not loading or error states)
                    if (content && !content.includes('Loading...') && !content.includes('Error:')) {
                        responses.push({
                            model: model.name,
                            content: content,
                            cost: cost
                        });
                    }
                }
            }
            
            // Only save if we have at least one response
            if (responses.length > 0) {
                await this.savePromptSession(systemPrompt, userPrompt, responses);
            }
        } catch (error) {
            console.error('Error saving prompt session after comparison:', error);
        }
    }

    // Initialize prompt history functionality
    initPromptHistory() {
        // Load prompt history on startup
        this.loadPromptHistory();

        // Search functionality
        const searchInput = document.getElementById('prompt-history-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchPromptHistory(e.target.value);
            });
        }

        // Modal event handlers
        const sessionModal = document.getElementById('prompt-session-modal');
        const closeModal = document.getElementById('close-prompt-session-modal');
        const closeSessionModal = document.getElementById('close-session-modal');
        const deleteSessionBtn = document.getElementById('delete-session-btn');

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                sessionModal.style.display = 'none';
            });
        }

        if (closeSessionModal) {
            closeSessionModal.addEventListener('click', () => {
                sessionModal.style.display = 'none';
            });
        }

        if (deleteSessionBtn) {
            deleteSessionBtn.addEventListener('click', () => {
                if (this.currentSessionId) {
                    this.deletePromptSession(this.currentSessionId);
                    sessionModal.style.display = 'none';
                }
            });
        }

        // Close modal when clicking outside
        if (sessionModal) {
            sessionModal.addEventListener('click', (e) => {
                if (e.target === sessionModal) {
                    sessionModal.style.display = 'none';
                }
            });
        }
    }
    
    // Ollama integration methods
    async onChatProviderChanged() {
        console.log('Chat provider changed to:', this.chatProvider);
        
        if (this.chatProvider === 'ollama') {
            // Show Ollama status section
            const ollamaStatus = document.getElementById('ollama-status-compact');
            if (ollamaStatus) {
                ollamaStatus.style.display = 'flex';
            }
            
            // Check Ollama status
            await this.checkOllamaStatus();
        } else {
            // Hide Ollama status section
            const ollamaStatus = document.getElementById('ollama-status-compact');
            if (ollamaStatus) {
                ollamaStatus.style.display = 'none';
            }
        }
        
        // Update model dropdown based on provider
        this.updateChatModelDropdown();
        
        // Show/hide internet context section based on provider
        this.updateInternetContextVisibility();
        
        // Update provider info display
        this.updateChatProviderInfo();
        
        // Reset selected model when switching providers
        this.selectedChatModel = null;
        this.disableChatInterface();
    }
    
    async checkOllamaStatus() {
        this.updateOllamaStatusUI('checking', 'Checking Ollama status...');
        
        try {
            // First check if Ollama is installed by trying to get version
            const versionResult = await ipcRenderer.invoke('check-ollama-installation');
            
            if (!versionResult.success) {
                this.ollamaStatus = 'not_installed';
                this.updateOllamaStatusUI('offline', 'Not installed');
                this.showOllamaActionButton('install');
                return;
            }
            
            // Check if Ollama server is running
            const statusResult = await this.pingOllamaServer();
            
            if (statusResult) {
                this.ollamaStatus = 'online';
                this.updateOllamaStatusUI('online', 'Running');
                this.showOllamaActionButton('stop');
                
                // Load Ollama models
                await this.loadOllamaModels();
            } else {
                this.ollamaStatus = 'offline';
                this.updateOllamaStatusUI('offline', 'Stopped');
                this.showOllamaActionButton('start');
            }
        } catch (error) {
            console.error('Error checking Ollama status:', error);
            this.ollamaStatus = 'unknown';
            this.updateOllamaStatusUI('offline', 'Error');
            this.showOllamaActionButton('start');
        }
    }
    
    async pingOllamaServer() {
        try {
            const response = await axios.get('http://localhost:11434/api/tags', {
                timeout: 3000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
    
    updateOllamaStatusUI(status, text) {
        const statusDot = document.getElementById('ollama-status-dot');
        const statusText = document.getElementById('ollama-status-text');
        
        if (statusDot) {
            statusDot.className = `status-dot ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
    }
    
    showOllamaActionButton(action) {
        const actionBtn = document.getElementById('ollama-action-btn');
        const refreshBtn = document.getElementById('ollama-refresh-btn');
        
        if (!actionBtn) return;
        
        const icon = actionBtn.querySelector('i');
        actionBtn.style.display = 'inline-flex';
        actionBtn.dataset.action = action;
        
        // Show/hide refresh button based on status
        if (refreshBtn) {
            if (action === 'stop') {
                // Show refresh button when Ollama is running
                refreshBtn.style.display = 'inline-flex';
            } else {
                // Hide refresh button when Ollama is not running
                refreshBtn.style.display = 'none';
            }
        }
        
        switch (action) {
            case 'start':
                icon.className = 'fas fa-play';
                actionBtn.title = 'Start Ollama';
                break;
            case 'stop':
                icon.className = 'fas fa-stop';
                actionBtn.title = 'Stop Ollama';
                break;
            case 'install':
                icon.className = 'fas fa-download';
                actionBtn.title = 'Install Ollama';
                break;
            default:
                actionBtn.style.display = 'none';
                if (refreshBtn) refreshBtn.style.display = 'none';
        }
    }
    
    handleOllamaAction() {
        const actionBtn = document.getElementById('ollama-action-btn');
        if (!actionBtn) return;
        
        const action = actionBtn.dataset.action;
        
        switch (action) {
            case 'start':
                this.startOllama();
                break;
            case 'stop':
                this.stopOllama();
                break;
            case 'install':
                this.openOllamaDownload();
                break;
        }
    }
    
    async startOllama() {
        const actionBtn = document.getElementById('ollama-action-btn');
        if (actionBtn) {
            actionBtn.disabled = true;
            actionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        try {
            const result = await ipcRenderer.invoke('start-ollama');
            
            if (result.success) {
                // Wait a bit for server to start, then check status
                setTimeout(() => {
                    this.checkOllamaStatus();
                }, 2000);
            } else {
                alert(`Failed to start Ollama: ${result.error}`);
                this.updateOllamaStatusUI('offline', 'Failed to start');
                this.showOllamaActionButton('start');
            }
        } catch (error) {
            console.error('Error starting Ollama:', error);
            alert('Failed to start Ollama. Please try starting it manually.');
        } finally {
            if (actionBtn) {
                actionBtn.disabled = false;
                this.showOllamaActionButton('start');
            }
        }
    }
    
    async stopOllama() {
        const actionBtn = document.getElementById('ollama-action-btn');
        if (actionBtn) {
            actionBtn.disabled = true;
            actionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        try {
            const result = await ipcRenderer.invoke('stop-ollama');
            
            if (result.success) {
                this.ollamaStatus = 'offline';
                this.updateOllamaStatusUI('offline', 'Stopped');
                this.showOllamaActionButton('start');
                this.ollamaModels = [];
                this.updateChatModelDropdown();
            } else {
                alert(`Failed to stop Ollama: ${result.error}`);
            }
        } catch (error) {
            console.error('Error stopping Ollama:', error);
            alert('Failed to stop Ollama. Please try stopping it manually.');
        } finally {
            if (actionBtn) {
                actionBtn.disabled = false;
                this.showOllamaActionButton('stop');
            }
        }
    }
    
    openOllamaDownload() {
        const { shell } = require('electron');
        shell.openExternal('https://ollama.com/download');
    }
    
    async loadOllamaModels() {
        try {
            console.log('Loading Ollama models...');
            const response = await axios.get('http://localhost:11434/api/tags', {
                timeout: 5000
            });
            
            console.log('Ollama API response:', response.data);
            
            if (response.data && response.data.models) {
                this.ollamaModels = response.data.models.map(model => ({
                    id: model.name,
                    name: model.name,
                    size: model.size,
                    modified_at: model.modified_at
                }));
                
                console.log(`Loaded ${this.ollamaModels.length} Ollama models:`, this.ollamaModels.map(m => m.name));
                
                // Update the dropdown after loading models
                this.updateChatModelDropdown();
            } else {
                console.warn('No models found in Ollama response or unexpected response format');
                this.ollamaModels = [];
            }
        } catch (error) {
            console.error('Error loading Ollama models:', error);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            this.ollamaModels = [];
        }
    }
    
    async refreshOllamaModels() {
        const refreshBtn = document.getElementById('ollama-refresh-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.className = 'fas fa-spinner fa-spin';
            refreshBtn.disabled = true;
        }
        
        try {
            await this.loadOllamaModels();
            console.log('Ollama models refreshed successfully');
        } catch (error) {
            console.error('Error refreshing Ollama models:', error);
        } finally {
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                icon.className = 'fas fa-sync-alt';
                refreshBtn.disabled = false;
            }
        }
    }
    
    updateInternetContextVisibility() {
        const internetContextSection = document.querySelector('.chat-context-selection');
        if (internetContextSection) {
            // Keep internet context visible for both providers
            internetContextSection.style.display = 'block';
        }
    }

    // Chat functionality methods
    updateChatUI() {
        this.updateChatModelDropdown();
        this.updateChatProviderInfo();
        this.updateChatSystemPromptDropdown();
        this.updateChatSystemPromptPreview();
        this.updateInternetContextVisibility();
    }
    
    updateChatModelDropdown() {
        if (!this.chatModelDropdown) {
            console.warn('Chat model dropdown not initialized yet');
            return;
        }
        
        let modelsToShow = [];
        
        if (this.chatProvider === 'openrouter' && this.availableModels.length > 0) {
            // Sort OpenRouter models same way as comparison dropdowns
            modelsToShow = this.availableModels
                .sort((a, b) => {
                    const aPopular = a.name.toLowerCase().includes('gpt') || 
                                   a.name.toLowerCase().includes('claude') || 
                                   a.name.toLowerCase().includes('llama') ||
                                   a.name.toLowerCase().includes('gemini');
                    const bPopular = b.name.toLowerCase().includes('gpt') || 
                                   b.name.toLowerCase().includes('claude') || 
                                   b.name.toLowerCase().includes('llama') ||
                                   b.name.toLowerCase().includes('gemini');
                    
                    if (aPopular && !bPopular) return -1;
                    if (!aPopular && bPopular) return 1;
                    return a.name.localeCompare(b.name);
                });
            console.log(`Updating chat model dropdown with ${modelsToShow.length} OpenRouter models`);
        } else if (this.chatProvider === 'ollama' && this.ollamaModels.length > 0) {
            // Use Ollama models
            modelsToShow = this.ollamaModels.sort((a, b) => a.name.localeCompare(b.name));
            console.log(`Updating chat model dropdown with ${modelsToShow.length} Ollama models`);
        } else {
            console.log(`No models available for provider: ${this.chatProvider} (OpenRouter: ${this.availableModels.length}, Ollama: ${this.ollamaModels.length})`);
        }
        
        this.chatModelDropdown.setOptions(modelsToShow);
        
        // Update placeholder based on provider and status
        const searchInput = this.chatModelDropdown.searchInput;
        if (searchInput) {
            if (this.chatProvider === 'ollama') {
                if (this.ollamaStatus === 'online' && this.ollamaModels.length > 0) {
                    searchInput.placeholder = 'Search Ollama models...';
                } else if (this.ollamaStatus === 'online' && this.ollamaModels.length === 0) {
                    searchInput.placeholder = 'No Ollama models found';
                } else {
                    searchInput.placeholder = 'Start Ollama to see models';
                }
            } else {
                if (this.availableModels.length > 0) {
                    searchInput.placeholder = 'Search OpenRouter models...';
                } else {
                    searchInput.placeholder = 'Configure API key to see models';
                }
            }
        }
    }
    
    updateChatProviderInfo() {
        const providerInfo = document.getElementById('chat-provider-info');
        const providerInfoContent = document.getElementById('chat-provider-info-content');
        
        if (!providerInfo || !providerInfoContent) {
            return;
        }

        // Remove existing classes
        providerInfo.classList.remove('tavily', 'openrouter');

        switch (this.chatInternetProvider) {
            case 'tavily':
                providerInfo.classList.add('tavily');
                providerInfoContent.innerHTML = `
                    <strong>Tavily Search:</strong> External search API that provides up-to-date web results.<br>
                    • Requires separate Tavily API key<br>
                    • Advanced search with content extraction<br>
                    • Works with both OpenRouter and Ollama models<br>
                    • Results are pre-processed and added to your prompt
                `;
                providerInfo.style.display = 'block';
                break;
                
            case 'openrouter':
                providerInfo.classList.add('openrouter');
                if (this.chatProvider === 'ollama') {
                    providerInfoContent.innerHTML = `
                        <strong>OpenRouter Web Search:</strong> Built-in web search using Exa.ai integration.<br>
                        • <strong>Note:</strong> Only available with OpenRouter models<br>
                        • Switch to OpenRouter provider to use this feature<br>
                        • Consider using Tavily search for local models instead
                    `;
                } else {
                    providerInfoContent.innerHTML = `
                        <strong>OpenRouter Web Search:</strong> Built-in web search using Exa.ai integration.<br>
                        • Uses your existing OpenRouter API key<br>
                        • Fetches up to 5 web results per request<br>
                        • <strong>Cost:</strong> $4 per 1,000 web results (added to model costs)<br>
                        • Results automatically integrated into model responses
                    `;
                }
                providerInfo.style.display = 'block';
                break;
                
            case 'none':
            default:
                providerInfo.style.display = 'none';
                break;
        }
    }
    
    updateChatSystemPromptDropdown() {
        if (!this.chatSystemPromptDropdown) return;
        
        // Make sure we have default prompts loaded
        if (!this.defaultPrompts || Object.keys(this.defaultPrompts).length === 0) {
            console.warn('Default prompts not loaded yet, skipping system prompt dropdown update');
            return;
        }
        
        // Create options for all available prompts
        const options = Object.keys(this.defaultPrompts).map(key => ({
            id: key,
            name: this.formatCategoryName(key)
        }));
        
        console.log('Updating chat system prompt dropdown with options:', options);
        this.chatSystemPromptDropdown.setOptions(options);
        
        // Set the current selection
        if (this.chatSystemPromptCategory) {
            this.chatSystemPromptDropdown.setValue(this.chatSystemPromptCategory);
        } else {
            // Default to first option if no category is set
            this.chatSystemPromptCategory = options[0]?.id || 'writing';
            this.chatSystemPromptDropdown.setValue(this.chatSystemPromptCategory);
        }
    }
    
    updateChatSystemPromptPreview() {
        const preview = document.getElementById('chat-system-prompt-preview');
        if (!preview) return;
        
        const promptContent = this.defaultPrompts[this.chatSystemPromptCategory] || this.defaultPrompts.other;
        preview.textContent = promptContent;
        
        // Start in collapsed state
        preview.classList.add('collapsed');
    }
    
    openChatSystemPromptModal() {
        // Set the current category to the chat category
        this.currentCategory = this.chatSystemPromptCategory;
        document.getElementById('category-select').value = this.chatSystemPromptCategory;
        this.updateSystemPromptContent();
        
        // Open the system prompt editor
        this.openSystemPromptEditor();
    }

    enableChatInterface() {
        const chatInput = document.getElementById('chat-message-input');
        const chatSendBtn = document.getElementById('chat-send-btn');
        
        if (chatInput && chatSendBtn && this.selectedChatModel) {
            chatInput.disabled = false;
            chatSendBtn.disabled = false;
            chatInput.placeholder = `Chat with ${this.selectedChatModel.name}...`;
            
            // Hide welcome message and show empty chat
            this.showChatInterface();
        }
    }
    
    disableChatInterface() {
        const chatInput = document.getElementById('chat-message-input');
        const chatSendBtn = document.getElementById('chat-send-btn');
        
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = 'Select a model to start chatting...';
        }
        
        if (chatSendBtn) {
            chatSendBtn.disabled = true;
        }
    }
    
    showChatInterface() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages && this.chatMessages.length === 0) {
            chatMessages.innerHTML = '';
        }
    }
    
    async sendChatMessage() {
        const chatInput = document.getElementById('chat-message-input');
        const message = chatInput.value.trim();
        
        if (!message || !this.selectedChatModel) {
            return;
        }
        
        if (!this.apiKey) {
            alert('Please configure your OpenRouter API key in Settings first.');
            return;
        }
        
        // Clear input
        chatInput.value = '';
        
        // Add user message to chat
        this.addChatMessage('user', message);
        
        // Show loading message
        const loadingId = this.addChatLoadingMessage();
        
        try {
            // Prepare model ID for web search if needed
            let modelId = this.selectedChatModel.id;
            let finalMessage = message;
            
            // Handle internet context for both providers
            let internetContext = '';
            
            // Fetch internet context if using Tavily (works with both OpenRouter and Ollama)
            if (this.chatInternetProvider === 'tavily' && this.tavilyApiKey) {
                console.log('Fetching internet context with Tavily...');
                try {
                    const context = await this.fetchInternetContext(message);
                    if (context) {
                        internetContext = this.formatInternetContext(context);
                        finalMessage = message + internetContext;
                        console.log('Tavily internet context added to chat message');
                    }
                } catch (error) {
                    console.error('Tavily internet search error:', error);
                    this.removeChatLoadingMessage(loadingId);
                    this.addChatMessage('assistant', 'Sorry, there was an error with the internet search. Please try again.', null, true);
                    return;
                }
            }
            
            // Handle OpenRouter web search (only for OpenRouter models)
            if (this.chatProvider === 'openrouter' && this.chatInternetProvider === 'openrouter') {
                modelId = this.selectedChatModel.id + ':online';
                finalMessage = message; // Don't add Tavily context for OpenRouter search
                console.log(`Using OpenRouter web search with model: ${modelId}`);
            }
            
            // Get the system prompt for the chat
            const systemPrompt = this.defaultPrompts[this.chatSystemPromptCategory] || this.defaultPrompts.other;
            
            // Call the appropriate LLM API based on provider
            let response;
            if (this.chatProvider === 'ollama') {
                response = await this.callOllamaChatLLM(this.selectedChatModel.id, systemPrompt, finalMessage);
            } else {
                response = await this.callChatLLM(modelId, systemPrompt, finalMessage);
            }
            
            // Remove loading message
            this.removeChatLoadingMessage(loadingId);
            
            // Add assistant response
            this.addChatMessage('assistant', response.content, response.cost);
            
            // Store the message pair
            this.chatMessages.push({
                user: message,
                assistant: response.content,
                model: this.selectedChatModel.name,
                cost: response.cost,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error sending chat message:', error);
            this.removeChatLoadingMessage(loadingId);
            this.addChatMessage('assistant', `Error: ${error.message}`, null, true);
        }
    }
    
    addChatMessage(role, content, cost = null, isError = false) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = `message-bubble ${role}`;
        if (isError) {
            bubbleDiv.style.background = '#fee2e2';
            bubbleDiv.style.color = '#dc2626';
            bubbleDiv.style.border = '1px solid #fecaca';
        }
        bubbleDiv.textContent = content;
        
        messageDiv.appendChild(bubbleDiv);
        
        // Add message info for assistant messages
        if (role === 'assistant' && !isError) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'message-info';
            
            const modelSpan = document.createElement('span');
            modelSpan.className = 'message-model';
            modelSpan.textContent = this.selectedChatModel.name;
            infoDiv.appendChild(modelSpan);
            
            if (cost && cost.totalCost > 0) {
                const costSpan = document.createElement('span');
                costSpan.className = 'message-cost';
                costSpan.textContent = `$${cost.totalCost.toFixed(6)}`;
                infoDiv.appendChild(costSpan);
            }
            
            messageDiv.appendChild(infoDiv);
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return messageDiv;
    }
    
    addChatLoadingMessage() {
        const chatMessages = document.getElementById('chat-messages');
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message assistant';
        
        const loadingBubble = document.createElement('div');
        loadingBubble.className = 'message-loading';
        loadingBubble.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Thinking...</span>
        `;
        
        loadingDiv.appendChild(loadingBubble);
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return loadingDiv;
    }
    
    removeChatLoadingMessage(loadingElement) {
        if (loadingElement && loadingElement.parentNode) {
            loadingElement.parentNode.removeChild(loadingElement);
        }
    }
    
    async callChatLLM(modelId, systemPrompt, message) {
        const messages = [];
        
        // Add system prompt if provided
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        
        // Add user message
        messages.push({ role: 'user', content: message });
        
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: modelId,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const content = response.data.choices[0].message.content;
        
        // Try to get cost information
        let costInfo = null;
        if (response.data.usage) {
            const usage = response.data.usage;
            costInfo = {
                inputTokens: usage.prompt_tokens || 0,
                outputTokens: usage.completion_tokens || 0,
                totalTokens: usage.total_tokens || 0,
                totalCost: 0 // Will be updated by generation API if available
            };
        }
        
        // Try to get detailed cost information
        const generationId = response.data.id;
        if (generationId) {
            try {
                // Wait a bit and try to get cost info
                setTimeout(async () => {
                    const detailedCost = await this.getGenerationCostWithRetry(generationId, 3, 2000);
                    if (detailedCost && detailedCost.totalCost > 0) {
                        // Update the cost display in the last assistant message
                        const chatMessages = document.getElementById('chat-messages');
                        const lastMessage = chatMessages.lastElementChild;
                        if (lastMessage && lastMessage.classList.contains('assistant')) {
                            const costSpan = lastMessage.querySelector('.message-cost');
                            if (costSpan) {
                                costSpan.textContent = `$${detailedCost.totalCost.toFixed(6)}`;
                            }
                        }
                    }
                }, 3000);
            } catch (error) {
                console.error('Error fetching detailed cost info:', error);
            }
        }
        
        // Add web search indicator if using OpenRouter web search
        let displayContent = content;
        if (modelId.includes(':online')) {
            displayContent = `🌐 Web Search Enabled\n\n${content}`;
        }
        
        return {
            content: displayContent,
            cost: costInfo
        };
    }
    
    async callOllamaChatLLM(modelId, systemPrompt, message) {
        // Combine system prompt and user message for Ollama
        let fullPrompt = message;
        if (systemPrompt) {
            fullPrompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;
        }
        
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: modelId,
            prompt: fullPrompt,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 1000
            }
        }, {
            timeout: 60000 // Ollama can be slower, especially for larger models
        });

        const content = response.data.response;
        
        // Ollama doesn't provide detailed cost information, but we can estimate tokens
        const estimatedInputTokens = this.estimateTokens(fullPrompt);
        const estimatedOutputTokens = this.estimateTokens(content);
        
        const costInfo = {
            inputTokens: estimatedInputTokens,
            outputTokens: estimatedOutputTokens,
            totalTokens: estimatedInputTokens + estimatedOutputTokens,
            totalCost: 0 // Local models are free
        };
        
        return {
            content: content,
            cost: costInfo
        };
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing PromptManager...');
    try {
        window.app = new PromptManager();
        console.log('PromptManager initialized successfully');
    } catch (error) {
        console.error('Error initializing PromptManager:', error);
    }
});
