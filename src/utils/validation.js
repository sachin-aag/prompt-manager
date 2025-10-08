// Input validation utilities

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} True if valid
 */
function isValidApiKey(apiKey) {
    return typeof apiKey === 'string' && apiKey.trim().length > 0;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate model selection
 * @param {object} model - Model object to validate
 * @returns {boolean} True if valid model
 */
function isValidModel(model) {
    return model && 
           typeof model === 'object' && 
           model.id && 
           model.name;
}

/**
 * Validate prompt content
 * @param {string} content - Prompt content to validate
 * @returns {object} Validation result with isValid and error message
 */
function validatePromptContent(content) {
    if (!content || typeof content !== 'string') {
        return { isValid: false, error: 'Content is required' };
    }
    
    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return { isValid: false, error: 'Content cannot be empty' };
    }
    
    if (trimmed.length > 50000) {
        return { isValid: false, error: 'Content is too long (max 50,000 characters)' };
    }
    
    return { isValid: true };
}

/**
 * Validate prompt title
 * @param {string} title - Prompt title to validate
 * @returns {object} Validation result with isValid and error message
 */
function validatePromptTitle(title) {
    if (!title || typeof title !== 'string') {
        return { isValid: false, error: 'Title is required' };
    }
    
    const trimmed = title.trim();
    if (trimmed.length === 0) {
        return { isValid: false, error: 'Title cannot be empty' };
    }
    
    if (trimmed.length > 200) {
        return { isValid: false, error: 'Title is too long (max 200 characters)' };
    }
    
    return { isValid: true };
}

module.exports = {
    isValidApiKey,
    isValidUrl,
    isValidModel,
    validatePromptContent,
    validatePromptTitle
};

