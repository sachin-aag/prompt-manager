// SearchableDropdown - Reusable dropdown component with search functionality

class SearchableDropdown {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`SearchableDropdown: Container with id '${containerId}' not found`);
            return;
        }
        
        this.searchInput = this.container.querySelector('.dropdown-search');
        this.menu = this.container.querySelector('.dropdown-menu');
        this.arrow = this.container.querySelector('.dropdown-arrow');
        this.options = [];
        this.filteredOptions = [];
        this.selectedValue = '';
        this.selectedIndex = -1;
        this.isOpen = false;
        this.visionFilterEnabled = false;
        
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
            // Only open on focus if not already open (prevents reopening after arrow close)
            if (!this.isOpen) {
                this.open();
            }
        });

        this.searchInput.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });

        // Arrow click toggles open/close
        if (this.arrow) {
            this.arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.isOpen) {
                    this.close();
                    // Blur the input to prevent focus event from reopening
                    this.searchInput && this.searchInput.blur();
                } else {
                    this.open();
                    // Focus the input for accessibility and keyboard nav
                    this.searchInput && this.searchInput.focus();
                }
            });
        }

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
        
        // Apply both search term and vision filter
        this.filteredOptions = this.options.filter(option => {
            const matchesSearch = option.name.toLowerCase().includes(term);
            const matchesVisionFilter = !this.visionFilterEnabled || option.supportsVision;
            return matchesSearch && matchesVisionFilter;
        });
        
        this.selectedIndex = -1;
        this.renderOptions();
    }

    renderOptions() {
        this.menu.innerHTML = '';
        
        // Add vision filter checkbox if this is the chat model dropdown
        if (this.container.id === 'chat-model-dropdown') {
            const filterContainer = document.createElement('div');
            filterContainer.className = 'dropdown-vision-filter';
            filterContainer.innerHTML = `
                <input type="checkbox" id="dropdown-chat-vision-filter" ${this.visionFilterEnabled ? 'checked' : ''}>
                <label for="dropdown-chat-vision-filter">Show only vision models</label>
            `;
            
            // Add event listener for the checkbox
            const checkbox = filterContainer.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                this.setVisionFilter(e.target.checked);
            });
            
            this.menu.appendChild(filterContainer);
            
            // Add separator
            const separator = document.createElement('div');
            separator.className = 'dropdown-separator';
            this.menu.appendChild(separator);
        }
        
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
            item.dataset.value = option.id;
            
            // Create item with badge if vision model
            item.innerHTML = `
                <span class="dropdown-item-name">${option.name}</span>
                ${option.supportsVision ? '<span class="vision-badge">Vision</span>' : ''}
            `;
            
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

    setVisionFilter(enabled) {
        this.visionFilterEnabled = enabled;
        // Re-filter with current search term
        this.filterOptions(this.searchInput.value);
    }
}

module.exports = SearchableDropdown;

