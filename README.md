# Prompt Manager

A powerful Electron desktop application for managing system prompts and comparing LLM outputs. This tool helps you organize, test, and compare different prompts across various language models through the OpenRouter API.

## Features

- **Prompt Management**: Create, edit, and organize system prompts and user prompts
- **LLM Comparison**: Test prompts across multiple language models simultaneously
- **OpenRouter Integration**: Seamless integration with OpenRouter API for accessing various LLMs
- **Side-by-Side Comparison**: View and compare outputs from different models in a clean interface
- **Export/Import**: Save and load prompt configurations
- **Modern UI**: Clean, responsive interface built with modern web technologies

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd prompt-manager
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

## Usage

### Managing Prompts

1. **System Prompts**: Define the behavior and context for your AI models
2. **User Prompts**: Create test prompts to evaluate model responses
3. **Organize**: Use categories and tags to keep your prompts organized

### Comparing Models

1. Select your system and user prompts
2. Choose the language models you want to compare
3. Run the comparison to see side-by-side outputs
4. Analyze differences and choose the best performing model

### API Configuration

The app uses OpenRouter API for accessing various language models. Make sure to configure your API key in the application settings.

## Development

### Available Scripts

- `npm start` - Start the application in development mode
- `npm run dev` - Start with development flags
- `npm run build` - Build the application for production
- `npm run dist` - Create distribution packages

### Project Structure

```
prompt-manager/
├── main.js              # Main Electron process
├── renderer.js          # Renderer process (UI logic)
├── index.html           # Main UI template
├── styles.css           # Application styles
├── data/                # Data storage
│   ├── system-prompts.json
│   └── user-prompts.json
└── package.json         # Project configuration
```

## Building for Distribution

The application supports building for multiple platforms:

- **macOS**: Creates `.app` and `.dmg` files
- **Windows**: Creates `.exe` installer
- **Linux**: Creates `.AppImage` file

Run `npm run dist` to build for all platforms.

## Technologies Used

- **Electron**: Cross-platform desktop app framework
- **HTML/CSS/JavaScript**: Frontend technologies
- **Axios**: HTTP client for API requests
- **Font Awesome**: Icons
- **Google Fonts**: Typography

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Author

Sachin Agrawal

## Support

For issues and feature requests, please use the GitHub issue tracker.