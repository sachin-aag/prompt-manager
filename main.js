const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev') || !app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for file operations
ipcMain.handle('save-prompts', async (event, prompts) => {
  try {
    const dataPath = path.join(__dirname, 'data');
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    
    const filePath = path.join(dataPath, 'prompts.json');
    fs.writeFileSync(filePath, JSON.stringify(prompts, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-prompts', async () => {
  try {
    const filePath = path.join(__dirname, 'data', 'prompts.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-prompts', async (event, prompts) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Prompts',
      defaultPath: 'prompts-export.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      fs.writeFileSync(result.filePath, JSON.stringify(prompts, null, 2));
      return { success: true };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-prompts', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Prompts',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const data = fs.readFileSync(result.filePaths[0], 'utf8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handlers for user prompts
ipcMain.handle('save-user-prompts', async (event, prompts) => {
  try {
    const dataPath = path.join(__dirname, 'data');
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    
    const filePath = path.join(dataPath, 'user-prompts.json');
    fs.writeFileSync(filePath, JSON.stringify(prompts, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-user-prompts', async () => {
  try {
    const filePath = path.join(__dirname, 'data', 'user-prompts.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handlers for prompt sessions (prompts with responses)
ipcMain.handle('save-prompt-session', async (event, sessionData) => {
  try {
    const dataPath = path.join(__dirname, 'data');
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    
    const filePath = path.join(dataPath, 'prompt-sessions.json');
    let sessions = [];
    
    // Load existing sessions
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      sessions = JSON.parse(data);
    }
    
    // Add new session
    sessions.push(sessionData);
    
    // Save updated sessions
    fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-prompt-sessions', async () => {
  try {
    const filePath = path.join(__dirname, 'data', 'prompt-sessions.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-prompt-session', async (event, sessionId) => {
  try {
    const filePath = path.join(__dirname, 'data', 'prompt-sessions.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      let sessions = JSON.parse(data);
      
      // Remove session with matching ID
      sessions = sessions.filter(session => session.id !== sessionId);
      
      fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
      return { success: true };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handlers for Ollama integration
ipcMain.handle('check-ollama-installation', async () => {
  return new Promise((resolve) => {
    exec('ollama --version', (error, stdout, stderr) => {
      if (error) {
        console.log('Ollama not installed:', error.message);
        resolve({ success: false, error: 'Ollama not installed' });
      } else {
        console.log('Ollama version:', stdout.trim());
        resolve({ success: true, version: stdout.trim() });
      }
    });
  });
});

ipcMain.handle('start-ollama', async () => {
  return new Promise((resolve) => {
    // Try to start Ollama server
    const ollamaProcess = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    
    ollamaProcess.unref(); // Allow the parent process to exit independently
    
    // Give it a moment to start
    setTimeout(() => {
      resolve({ success: true, message: 'Ollama server started' });
    }, 1000);
    
    ollamaProcess.on('error', (error) => {
      console.error('Error starting Ollama:', error);
      resolve({ success: false, error: error.message });
    });
  });
});

ipcMain.handle('stop-ollama', async () => {
  return new Promise((resolve) => {
    // On macOS/Linux, try to find and kill the ollama process
    if (process.platform === 'win32') {
      exec('taskkill /f /im ollama.exe', (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, message: 'Ollama server stopped' });
        }
      });
    } else {
      exec('pkill -f "ollama serve"', (error, stdout, stderr) => {
        // pkill returns non-zero if no processes found, but that's okay
        resolve({ success: true, message: 'Ollama server stopped' });
      });
    }
  });
});
