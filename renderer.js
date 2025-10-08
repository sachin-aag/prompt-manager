// Prompt Manager - Main Entry Point
// This file bootstraps the application using the modular architecture

const App = require('./src/App');

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Prompt Manager...');
    
    try {
        // Create and expose the app instance globally for debugging
        window.app = new App();
        console.log('Prompt Manager initialized successfully');
    } catch (error) {
        console.error('Error initializing Prompt Manager:', error);
        alert('Failed to initialize application. Check console for details.');
    }
});
