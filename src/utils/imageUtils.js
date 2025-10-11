// Image Utilities - Handle image file processing and base64 conversion

/**
 * Convert an image file to base64 data URL
 * @param {File} file - Image file
 * @returns {Promise<string>} Base64 data URL
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
            resolve(reader.result); // Already includes data:image/...;base64, prefix
        };
        
        reader.onerror = (error) => {
            reject(new Error('Failed to read image file: ' + error.message));
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * Validate image file
 * @param {File} file - File to validate
 * @returns {object} Validation result {valid: boolean, error: string}
 */
function validateImageFile(file) {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    const maxSize = 20 * 1024 * 1024; // 20MB
    
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }
    
    if (!validTypes.includes(file.type)) {
        return { 
            valid: false, 
            error: `Invalid file type. Supported types: ${validTypes.join(', ')}` 
        };
    }
    
    if (file.size > maxSize) {
        return { 
            valid: false, 
            error: `File size exceeds 20MB limit` 
        };
    }
    
    return { valid: true };
}

/**
 * Check if a model supports vision/multimodal capabilities
 * @param {string} modelId - Model ID
 * @param {string} provider - Provider (openrouter or ollama)
 * @returns {boolean} True if model supports vision
 */
function isVisionModel(modelId, provider = 'openrouter') {
    if (!modelId) return false;
    
    const modelLower = modelId.toLowerCase();
    
    // OpenRouter vision models
    const visionKeywords = [
        'vision',
        'gpt-4-vision',
        'gpt-4o',
        'gpt-4-turbo',
        'claude-3',
        'gemini',
        'llava',
        'bakllava',
        'llama-3.2-vision',
        'pixtral',
        'qwen-vl',
        'cogvlm',
        'internvl',
        'minicpm-v'
    ];
    
    // Check if model name contains any vision keywords
    return visionKeywords.some(keyword => modelLower.includes(keyword));
}

/**
 * Get readable file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Create image preview element
 * @param {string} dataUrl - Base64 data URL
 * @param {string} fileName - File name
 * @returns {HTMLElement} Preview element
 */
function createImagePreview(dataUrl, fileName) {
    const container = document.createElement('div');
    container.className = 'image-preview-item';
    
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = fileName;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'image-preview-remove';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.title = 'Remove image';
    
    const fileNameElement = document.createElement('div');
    fileNameElement.className = 'image-preview-name';
    fileNameElement.textContent = fileName;
    
    container.appendChild(img);
    container.appendChild(removeBtn);
    container.appendChild(fileNameElement);
    
    return container;
}

module.exports = {
    fileToBase64,
    validateImageFile,
    isVisionModel,
    formatFileSize,
    createImagePreview
};

