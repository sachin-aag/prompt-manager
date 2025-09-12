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
        this.availableModels = [];
        this.modelDropdowns = [];
        this.currentSessionId = null;
        this.internetAccessProvider = 'none';
        
        // Simple pricing data for common models (per 1M tokens)
        this.modelPricing = {
            'gpt-4': { input: 30.0, output: 60.0 },
            'gpt-4-turbo': { input: 10.0, output: 30.0 },
            'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
            'claude-3-opus': { input: 15.0, output: 75.0 },
            'claude-3-sonnet': { input: 3.0, output: 15.0 },
            'claude-3-haiku': { input: 0.25, output: 1.25 },
            'llama-2-70b': { input: 0.7, output: 0.9 },
            'llama-2-13b': { input: 0.2, output: 0.2 },
            'llama-2-7b': { input: 0.1, output: 0.1 },
            'gemini-pro': { input: 0.5, output: 1.5 },
            'gemini-pro-vision': { input: 0.5, output: 1.5 }
        };
        
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

        // User prompt management
        this.safeAddEventListener('new-user-prompt-btn', 'click', () => {
            this.openUserPromptEditor();
        });

        this.safeAddEventListener('import-user-prompts-btn', 'click', () => {
            this.importUserPrompts();
        });

        this.safeAddEventListener('export-user-prompts-btn', 'click', () => {
            this.exportUserPrompts();
        });

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

        // Internet access dropdown
        document.getElementById('internet-access-select').addEventListener('change', (e) => {
            this.internetAccessProvider = e.target.value;
        });

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
            
            // Check for specific models
            const qwenModels = this.availableModels.filter(m => m.name.toLowerCase().includes('qwen'));
            const deepseekModels = this.availableModels.filter(m => m.name.toLowerCase().includes('deepseek'));
            console.log('Qwen models found:', qwenModels.length, qwenModels.map(m => m.name));
            console.log('DeepSeek models found:', deepseekModels.length, deepseekModels.map(m => m.name));
            
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

        // Fetch internet context if enabled
        let internetContext = '';
        if (this.internetAccessProvider === 'tavily' && this.tavilyApiKey) {
            console.log('Fetching internet context...');
            const context = await this.fetchInternetContext(userMessage);
            if (context) {
                internetContext = this.formatInternetContext(context);
                console.log('Internet context added to prompt');
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
            await this.callLLM(model.id, model.name, systemPrompt, userMessage + internetContext, model.slot);
        }

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
            
            // Calculate output tokens and cost
            const outputTokens = this.estimateTokens(content);
            const costInfo = this.calculateCost(modelId, inputTokens, outputTokens);
            
            this.updateModelOutput(slotNumber, content, costInfo);
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
            const costText = `$${costInfo.totalCost.toFixed(6)} (${costInfo.inputTokens}→${costInfo.outputTokens} tokens)`;
            costDisplay.textContent = costText;
            costDisplay.style.display = 'block';
        } else {
            costDisplay.style.display = 'none';
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
            return null;
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
        
        // Load API keys if available
        if (this.apiKey) {
            document.getElementById('api-key').value = this.apiKey;
        }
        if (this.tavilyApiKey) {
            document.getElementById('tavily-api-key').value = this.tavilyApiKey;
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
            
            // Update all dropdowns with all available models
            this.modelDropdowns.forEach(dropdown => {
                dropdown.setOptions(sortedModels);
            });
        } else {
            // Show empty state for all dropdowns
            this.modelDropdowns.forEach(dropdown => {
                dropdown.setOptions([]);
            });
        }
    }

    // Simple token estimation (rough approximation)
    estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters for English text
        // This is a simplified approach - in production, use proper tokenizers
        return Math.ceil(text.length / 4);
    }

    // Calculate cost based on model and token usage
    calculateCost(modelId, inputTokens, outputTokens) {
        // Try to find pricing for the model
        let pricing = null;
        
        // Check for exact match first
        if (this.modelPricing[modelId]) {
            pricing = this.modelPricing[modelId];
        } else {
            // Try to match by model name patterns
            const modelName = modelId.toLowerCase();
            if (modelName.includes('gpt-4')) {
                pricing = modelName.includes('turbo') ? this.modelPricing['gpt-4-turbo'] : this.modelPricing['gpt-4'];
            } else if (modelName.includes('gpt-3.5')) {
                pricing = this.modelPricing['gpt-3.5-turbo'];
            } else if (modelName.includes('claude-3-opus')) {
                pricing = this.modelPricing['claude-3-opus'];
            } else if (modelName.includes('claude-3-sonnet')) {
                pricing = this.modelPricing['claude-3-sonnet'];
            } else if (modelName.includes('claude-3-haiku')) {
                pricing = this.modelPricing['claude-3-haiku'];
            } else if (modelName.includes('llama-2-70b')) {
                pricing = this.modelPricing['llama-2-70b'];
            } else if (modelName.includes('llama-2-13b')) {
                pricing = this.modelPricing['llama-2-13b'];
            } else if (modelName.includes('llama-2-7b')) {
                pricing = this.modelPricing['llama-2-7b'];
            } else if (modelName.includes('gemini-pro')) {
                pricing = this.modelPricing['gemini-pro'];
            }
        }

        if (!pricing) {
            // Default pricing for unknown models (conservative estimate)
            pricing = { input: 1.0, output: 2.0 };
        }

        // Calculate cost (pricing is per 1M tokens)
        const inputCost = (inputTokens / 1000000) * pricing.input;
        const outputCost = (outputTokens / 1000000) * pricing.output;
        const totalCost = inputCost + outputCost;

        return {
            inputCost,
            outputCost,
            totalCost,
            inputTokens,
            outputTokens
        };
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
