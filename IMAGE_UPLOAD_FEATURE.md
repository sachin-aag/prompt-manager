# Image Upload Feature Documentation

## Overview

The Prompt Manager now supports multimodal inputs, allowing you to upload and send images along with your text prompts to vision-capable AI models. This feature works with both OpenRouter and Ollama vision models.

## Supported Models

### OpenRouter Vision Models
- GPT-4 Vision / GPT-4o / GPT-4 Turbo
- Claude 3 (Opus, Sonnet, Haiku)
- Gemini (Pro Vision, Ultra)
- Pixtral
- LLaVA variants
- And other vision-capable models

### Ollama Vision Models
- LLaVA
- BakLLaVA
- Llama 3.2 Vision
- MiniCPM-V
- CogVLM
- InternVL
- And other locally-run vision models

## How to Use

### In Simple Chat

1. **Select a Vision Model**: Choose a vision-capable model from the model dropdown
2. **Add Images**: Click the "Add Images" button above the chat input
3. **Select Files**: Choose one or more images (PNG, JPEG, JPG, WebP, or GIF)
4. **Review Previews**: Your images will appear as thumbnails with remove buttons
5. **Type Message**: Enter your text prompt about the images
6. **Send**: Click Send to submit both text and images to the model

### In Model Comparison

1. **Select Vision Models**: Choose vision-capable models in the comparison slots
2. **Add Images**: Click the "Add Images" button in the prompt section
3. **Select Files**: Choose one or more images to analyze
4. **Review Previews**: Your images will appear as thumbnails
5. **Enter Prompt**: Type your question or instruction about the images
6. **Run Comparison**: Click "Run Comparison" to see how different models analyze the same images

## Image Requirements

- **Supported Formats**: PNG, JPEG, JPG, WebP, GIF
- **Maximum File Size**: 20MB per image
- **Multiple Images**: You can upload multiple images in a single request

## Error Handling

### Non-Vision Model Selected

If you upload images but select a model that doesn't support vision:

**Chat Tab Error:**
```
⚠️ The selected model "model-name" does not support image inputs. 
Please select a vision-capable model (e.g., GPT-4 Vision, Claude 3, Gemini, LLaVA) 
or remove the images to continue.
```

**Comparison Tab Error:**
```
⚠️ The following selected model(s) do not support image inputs: model-name-1, model-name-2. 
Please select vision-capable models (e.g., GPT-4 Vision, Claude 3, Gemini) 
or remove the images to continue.
```

### Invalid File Format

If you try to upload an unsupported file type:
```
Invalid file type. Supported types: image/png, image/jpeg, image/jpg, image/webp, image/gif
```

### File Too Large

If a file exceeds the size limit:
```
File size exceeds 20MB limit
```

## Technical Implementation

### Architecture

The feature is implemented across multiple layers:

1. **UI Layer** (`UIController.js`):
   - Image upload button handlers
   - Image preview rendering
   - Vision model validation
   - Error message display

2. **API Layer**:
   - **OpenRouterAPI**: Transforms messages to OpenRouter's multimodal format
   - **OllamaAPI**: Converts images to base64 and uses Ollama's chat API

3. **Manager Layer**:
   - **ChatManager**: Handles image arrays in chat context
   - **ComparisonManager**: Distributes images to multiple models

4. **Utilities** (`imageUtils.js`):
   - File validation
   - Base64 conversion
   - Vision model detection
   - Image preview creation

### Message Format

#### OpenRouter Format
```javascript
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "What's in this image?"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "data:image/jpeg;base64,..."
      }
    }
  ]
}
```

#### Ollama Format
```javascript
{
  "role": "user",
  "content": "What's in this image?",
  "images": ["base64-encoded-image-data"]
}
```

## Best Practices

1. **Choose the Right Model**: Not all models have the same vision capabilities. GPT-4 Vision, Claude 3, and Gemini are generally the most capable.

2. **Clear Prompts**: Be specific about what you want to know about the images.

3. **Image Quality**: Higher quality images generally produce better results, but stay within the 20MB limit.

4. **Multiple Images**: When uploading multiple images, mention them in your prompt (e.g., "Compare these two images").

5. **Remove After Use**: Images are automatically cleared after sending, but you can manually remove them using the X button on each preview.

## Example Use Cases

### Image Analysis
- **Prompt**: "Describe everything you see in this image in detail"
- **Models**: GPT-4 Vision, Claude 3

### Comparison
- **Prompt**: "Which of these two products looks better for a professional setting?"
- **Models**: Multiple vision models to compare their aesthetic judgments

### OCR/Text Extraction
- **Prompt**: "Extract all the text from this document"
- **Models**: GPT-4 Vision, Claude 3 (excellent OCR capabilities)

### Code from Screenshot
- **Prompt**: "Convert this UI design to HTML/CSS code"
- **Models**: GPT-4 Vision, Claude 3

### Medical/Scientific
- **Prompt**: "Describe the patterns you see in this medical scan"
- **Models**: Specialized vision models

## Troubleshooting

### Images Not Sending
- Verify you've selected a vision-capable model
- Check that images are under 20MB
- Ensure images are in a supported format

### Poor Results
- Try a different vision model
- Improve image quality
- Make your prompt more specific
- Try cropping to focus on relevant areas

### Model Errors
- Some models have different context length limits with images
- Try reducing the number of images or image size
- Check your API key has access to vision models

## API Reference

See the [OpenRouter Image Documentation](https://openrouter.ai/docs/features/multimodal/images) for detailed API specifications.

## Future Enhancements

Potential improvements for future versions:
- Image compression before upload
- Drag-and-drop support
- Paste from clipboard
- Image editing/cropping tools
- Support for image URLs (not just file uploads)
- Batch image processing

