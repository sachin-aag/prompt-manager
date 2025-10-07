# Perplexity Search Integration

## Overview
This document describes the Perplexity Search API integration added to the Prompt Manager application.

## Changes Made

### 1. User Interface (index.html)

#### Added Navigation Button
- New "Perplexity Search" tab in the sidebar navigation
- Icon: Font Awesome search icon (`fa-search`)

#### Added Search Tab
- Search query textarea for entering search terms
- Country dropdown with 20+ country options
- "Worldwide" option for non-regional searches
- Results section displaying search results
- Clean, modern layout with proper spacing and styling

#### Added Settings
- New "Perplexity API" section in Settings tab
- API key input field (password type for security)
- Save button for storing the API key

### 2. Styling (styles.css)

Added comprehensive styles for:
- Search container layout
- Input controls and buttons
- Results display with cards
- Numbered result items (1-10)
- Hover effects and transitions
- Loading states with spinner animation
- Error states with appropriate styling
- Responsive design for mobile devices

### 3. JavaScript Functionality (renderer.js)

#### API Key Management
- Added `perplexityApiKey` property to PromptManager constructor
- Loads from localStorage on initialization
- `savePerplexityApiKey()` method for saving API key
- `loadSettingsValues()` method for populating settings form

#### Search Functionality
- `performPerplexitySearch()` - Main search handler
  - Validates query and API key
  - Builds request payload with optional country filter
  - Makes API call to Perplexity Search API
  - Handles loading and error states
  
- `displayPerplexityResults()` - Results renderer
  - Displays top 10 search results
  - Shows title, URL, snippet, and metadata
  - Includes date and last updated information
  - Numbered result items for easy reference

- `escapeHtml()` - Security helper for safe HTML rendering

#### Event Listeners
- Search button click handler
- API key save button handler
- Tab switching to load settings values

## API Integration Details

### Endpoint
```
POST https://api.perplexity.ai/search
```

### Request Format
```json
{
  "query": "search query",
  "max_results": 10,
  "max_tokens_per_page": 1024,
  "country": "US" // Optional, omitted for worldwide search
}
```

### Authentication
```
Authorization: Bearer {PERPLEXITY_API_KEY}
```

### Response Handling
- Displays up to 10 search results
- Shows title, URL, snippet, date, and last updated timestamp
- Provides clickable links to source websites
- Shows error messages for API failures

## Usage Instructions

1. **Configure API Key**
   - Navigate to Settings tab
   - Enter your Perplexity API key in the "Perplexity API" section
   - Click "Save Perplexity API Key"

2. **Perform a Search**
   - Navigate to "Perplexity Search" tab
   - Enter your search query in the textarea
   - Select a country from the dropdown (default: Worldwide)
   - Click "Search" button

3. **View Results**
   - Results appear in a scrollable table below the search form
   - Table columns:
     - **#**: Result number (1-10)
     - **Title**: Page title (clickable link)
     - **URL**: Full URL (clickable link)
     - **Content**: Text excerpt from the webpage
   - The table is fully scrollable both vertically and horizontally
   - Header row is sticky and stays visible while scrolling

## Features

- ✅ Regional search with 20+ country options
- ✅ Worldwide search (non-regional)
- ✅ Top 10 results display
- ✅ Table-based results layout with columns for Title, URL, and Content
- ✅ Scrollable results area with sticky header
- ✅ Full-width content preview for each result
- ✅ Loading states with spinner
- ✅ Error handling and user feedback
- ✅ Secure API key storage
- ✅ Modern, responsive UI
- ✅ Clickable result links (open in new tab)
- ✅ Clean, organized table display with hover effects

## Security

- API keys stored in localStorage
- Password-type input fields to hide API keys
- HTML escaping for search result snippets
- Secure HTTPS API calls

## Error Handling

The integration includes robust error handling for:
- Missing API key
- Empty search query
- API request failures
- Network errors
- No results found

## Browser Compatibility

The integration uses modern JavaScript features and is designed to work with:
- Electron's Chromium engine
- Modern web browsers (Chrome, Firefox, Safari, Edge)

## Future Enhancements

Potential improvements for future versions:
- Multi-query search support
- Custom max_results selection
- Search history
- Result export functionality
- Advanced filtering options
- Search result caching

