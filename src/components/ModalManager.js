// ModalManager - Manage modal dialogs
class ModalManager {
    constructor() {
        this.modals = {};
        this.currentData = {};
    }

    /**
     * Register a modal
     * @param {string} name - Modal name
     * @param {string} elementId - Modal element ID
     */
    register(name, elementId) {
        const modal = document.getElementById(elementId);
        if (modal) {
            this.modals[name] = modal;
        }
    }

    /**
     * Open a modal
     * @param {string} name - Modal name
     * @param {object} data - Data to populate modal
     */
    open(name, data = {}) {
        const modal = this.modals[name];
        if (!modal) {
            console.error(`Modal '${name}' not found`);
            return;
        }
        
        this.currentData[name] = data;
        modal.style.display = 'flex';
        
        // Populate modal with data if provided
        if (data && data.populateFunction) {
            data.populateFunction(modal, data);
        }
    }

    /**
     * Close a modal
     * @param {string} name - Modal name
     */
    close(name) {
        const modal = this.modals[name];
        if (!modal) {
            console.error(`Modal '${name}' not found`);
            return;
        }
        
        modal.style.display = 'none';
        this.currentData[name] = null;
    }

    /**
     * Close all modals
     */
    closeAll() {
        Object.values(this.modals).forEach(modal => {
            modal.style.display = 'none';
        });
        this.currentData = {};
    }

    /**
     * Get current modal data
     * @param {string} name - Modal name
     * @returns {object|null} Modal data
     */
    getData(name) {
        return this.currentData[name] || null;
    }

    /**
     * Setup modal close handlers
     * @param {string} name - Modal name
     * @param {Array<string>} closeButtonIds - IDs of close buttons
     */
    setupCloseHandlers(name, closeButtonIds) {
        closeButtonIds.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => this.close(name));
            }
        });
        
        // Click outside to close
        const modal = this.modals[name];
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close(name);
                }
            });
        }
    }
}

module.exports = ModalManager;

