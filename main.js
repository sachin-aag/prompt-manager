const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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
