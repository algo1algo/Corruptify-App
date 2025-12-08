import { app, BrowserWindow, ipcMain, shell, dialog, IpcMainInvokeEvent, Menu } from 'electron';
import * as path from 'path';
import { corruptFile } from '../corruption/corruptor';
import { log, getLogFiles, readLogFile, getLogFilePath } from '../utils/logger';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadPath = path.join(__dirname, '../preload/preload.js');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
    title: 'Corruptify',
    resizable: true,
    minWidth: 600,
    minHeight: 550,
    show: false,
    backgroundColor: '#1a1a1a', // Match app background to prevent white flash
  });

  const htmlPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(htmlPath);
  
  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        {
          label: `About ${app.getName()}`,
          click: async () => {
            await dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: `About ${app.getName()}`,
              message: app.getName(),
              detail: `Version ${app.getVersion()}\n\nCopyright © 2025 algo1alg0\n\nCorrupt audio and video files with various corruption types.`,
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Files',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (mainWindow) {
              const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openFile', 'multiSelections'],
                filters: [
                  { name: 'Media Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] },
                  { name: 'All Files', extensions: ['*'] },
                ],
              });
              if (!result.canceled && result.filePaths.length > 0) {
                mainWindow.webContents.send('menu-add-files', result.filePaths);
              }
            }
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Open Logs Folder',
          click: async () => {
            try {
              const logPath = getLogFilePath();
              const logDir = path.dirname(logPath);
              await shell.openPath(logDir);
            } catch (error: any) {
              await log('ERROR', 'Failed to open log folder', { error: error.message });
            }
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  await log('INFO', 'Application started');
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('corrupt-file', async (_event: IpcMainInvokeEvent, filePath: string, corruptionType: string, outputDir: string, level: number = 5) => {
  await log('INFO', 'Processing file', { filePath, corruptionType, level });
  try {
    const result = await corruptFile(filePath, corruptionType as any, outputDir, level);
    await log('INFO', 'File processed successfully', { 
      inputPath: filePath, 
      outputPath: result.outputPath, 
      corruptionType,
      level,
      hasDiagnostics: !!result.diagnostics 
    });
    return { success: true, outputPath: result.outputPath, diagnostics: result.diagnostics, error: null };
  } catch (error: any) {
    await log('ERROR', 'File processing failed', { 
      filePath, 
      corruptionType, 
      level, 
      error: error.message 
    });
    return { success: false, outputPath: null, diagnostics: null, error: error.message || 'Unknown error occurred' };
  }
});

ipcMain.handle('reveal-in-folder', async (_event: IpcMainInvokeEvent, filePath: string) => {
  try {
    await shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled) {
    return { canceled: true, filePaths: [] };
  }

  return { canceled: false, filePaths: result.filePaths };
});

// Logging IPC handlers
ipcMain.handle('get-log-files', async () => {
  try {
    const files = await getLogFiles();
    return { success: true, files };
  } catch (error: any) {
    await log('ERROR', 'Failed to get log files', { error: error.message });
    return { success: false, files: [], error: error.message };
  }
});

ipcMain.handle('read-log-file', async (_event: IpcMainInvokeEvent, filePath: string) => {
  try {
    const content = await readLogFile(filePath);
    return { success: true, content };
  } catch (error: any) {
    await log('ERROR', 'Failed to read log file', { filePath, error: error.message });
    return { success: false, content: '', error: error.message };
  }
});

ipcMain.handle('open-log-folder', async () => {
  try {
    const logPath = getLogFilePath();
    const logDir = path.dirname(logPath);
    await shell.openPath(logDir);
    return { success: true };
  } catch (error: any) {
    await log('ERROR', 'Failed to open log folder', { error: error.message });
    return { success: false, error: error.message };
  }
});

