import { contextBridge, ipcRenderer } from 'electron';

// Listen for menu actions
ipcRenderer.on('menu-add-files', (_event, filePaths: string[]) => {
  window.dispatchEvent(new CustomEvent('menu-add-files', { detail: filePaths }));
});

contextBridge.exposeInMainWorld('electronAPI', {
  corruptFile: (filePath: string, corruptionType: string, outputDir: string, level: number) =>
    ipcRenderer.invoke('corrupt-file', filePath, corruptionType, outputDir, level) as Promise<{ success: boolean; outputPath: string | null; diagnostics: string | null; error: string | null }>,
  
  revealInFolder: (filePath: string) =>
    ipcRenderer.invoke('reveal-in-folder', filePath),
  
  openFileDialog: () =>
    ipcRenderer.invoke('open-file-dialog'),
  
  getLogFiles: () =>
    ipcRenderer.invoke('get-log-files') as Promise<{ success: boolean; files: string[]; error?: string }>,
  
  readLogFile: (filePath: string) =>
    ipcRenderer.invoke('read-log-file', filePath) as Promise<{ success: boolean; content: string; error?: string }>,
  
  openLogFolder: () =>
    ipcRenderer.invoke('open-log-folder') as Promise<{ success: boolean; error?: string }>,
});

