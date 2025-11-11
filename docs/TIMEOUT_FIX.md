# Timeout Error Fixes

## Problem
Users were experiencing frequent timeout errors with OpenRouter API:
```
Error calling OpenRouter: AxiosError {message: 'timeout of 30000ms exceeded', ...}
```

The 30-second timeout was too short for:
- Large/slow models (e.g., Claude, GPT-4)
- Requests with images (multimodal)
- High max_tokens settings
- API under heavy load

## Solutions Implemented

### 1. Increased Timeout Duration
**File: `src/constants/config.js`**

- Increased `DEFAULT_TIMEOUT` from 30s to 120s (2 minutes)
- This gives models more time to generate responses, especially for complex requests

```javascript
DEFAULT_TIMEOUT: 120000, // 2 minutes for complex LLM requests
```

### 2. Automatic Retry Logic with Exponential Backoff
**Files: `src/services/api/OpenRouterAPI.js`, `src/services/api/OllamaAPI.js`**

Added intelligent retry mechanism:
- **Max 2 retries** (3 total attempts)
- **Exponential backoff**: 1s, 2s delays between retries
- **Smart retry conditions**: Only retries on:
  - Timeout errors (`ECONNABORTED`)
  - Network errors (`ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`)
  - Server errors (5xx status codes)
- **No retry on client errors**: 4xx errors fail immediately (invalid API key, rate limits, etc.)

### 3. Better Error Messages
Enhanced error handling to provide actionable feedback:

**Timeout errors:**
```
Request timeout - The model took too long to respond (>120s). 
Try: 1) Using a faster model, 2) Reducing max tokens, 3) Checking your internet connection
```

**Rate limit errors:**
```
Rate limit exceeded - Please wait a moment and try again
```

**Service unavailable:**
```
Service temporarily unavailable - The model may be overloaded, try again in a moment
```

### 4. Request Logging
Added detailed logging to help debug issues:
- Shows attempt number: `(attempt 1/3)`
- Logs retry attempts with delays
- Shows success with latency: `✓ OpenRouter request succeeded (1234ms)`
- Warns on retryable failures

## Configuration

The retry behavior can be adjusted in `src/constants/config.js`:

```javascript
MAX_RETRIES: 2,           // Number of retry attempts (default: 2)
RETRY_DELAY: 1000,        // Initial retry delay in ms (default: 1s)
DEFAULT_TIMEOUT: 120000,  // Request timeout in ms (default: 2min)
OLLAMA_TIMEOUT: 60000     // Ollama timeout in ms (default: 1min)
```

## User Impact

### Before:
- Frequent timeout errors on slow models
- No automatic recovery
- Unclear error messages
- Frustrating user experience

### After:
- Most timeout issues resolved with increased timeout
- Automatic retry on transient failures
- Clear, actionable error messages
- Seamless experience with transparent retries

## Technical Details

### Retry Logic Flow:
1. First attempt with full timeout
2. If timeout/network error → wait 1s → retry
3. If still fails → wait 2s → final retry
4. If all fail → show detailed error message

### Exponential Backoff Formula:
```javascript
delay = RETRY_DELAY * Math.pow(2, attempt - 1)
// attempt 1: 1000ms * 2^0 = 1000ms (1s)
// attempt 2: 1000ms * 2^1 = 2000ms (2s)
```

### What Gets Retried:
✅ Timeout errors (ECONNABORTED)
✅ Network errors (ETIMEDOUT, ENOTFOUND, ECONNREFUSED)
✅ Server errors (500-599 status codes)

### What Doesn't Get Retried:
❌ Authentication errors (401)
❌ Rate limits (429) - handled separately
❌ Bad requests (400)
❌ Other 4xx client errors

## Testing

To test the timeout handling:
1. Use a slow model (e.g., Claude 3 Opus)
2. Set high max_tokens (e.g., 4000)
3. Add images to the request
4. The system should now handle these gracefully

## Future Improvements

Possible enhancements:
- [ ] Configurable timeout per model (faster models = shorter timeout)
- [ ] Progress indicator showing retry attempts in UI
- [ ] Cancel/abort button for long-running requests
- [ ] Adaptive timeout based on historical response times
- [ ] Queue system for rate-limited requests

## Related Files

- `src/constants/config.js` - Timeout and retry configuration
- `src/services/api/OpenRouterAPI.js` - OpenRouter with retry logic
- `src/services/api/OllamaAPI.js` - Ollama with retry logic
- `src/features/chat/ChatManager.js` - Uses these APIs
- `src/features/comparison/ComparisonManager.js` - Uses these APIs

## Changelog

**2024-11-10**
- Increased DEFAULT_TIMEOUT from 30s to 120s
- Added retry logic with exponential backoff (max 2 retries)
- Enhanced error messages with actionable suggestions
- Added request logging with attempt tracking
- Applied to both OpenRouter and Ollama APIs

