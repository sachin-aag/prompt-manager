// Text formatting and manipulation utilities

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format category name for display
 * Converts hyphenated keys to Title Case (e.g., 'my-category' -> 'My Category')
 * @param {string} key - Category key
 * @returns {string} Formatted category name
 */
function formatCategoryName(key) {
    return key.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

/**
 * Simple token estimation (rough approximation)
 * In production, use proper tokenizers like tiktoken
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated number of tokens
 */
function estimateTokens(text) {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
}

/**
 * Format cost for display
 * @param {number} cost - Cost in dollars
 * @returns {string} Formatted cost string
 */
function formatCost(cost) {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
}

/**
 * Format timestamp to readable date
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted date string
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

module.exports = {
    escapeHtml,
    formatCategoryName,
    estimateTokens,
    formatCost,
    formatDate
};

