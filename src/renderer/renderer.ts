// electronAPI is exposed by preload script on window object

interface FileItem {
  path: string;
  name: string;
}

let selectedFiles: FileItem[] = [];

// Allowed media file extensions
const ALLOWED_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.m4v', '.wmv', '.wma'];

function isValidMediaFile(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
  
  // Check if electronAPI is available
  if (!(window as any).electronAPI) {
    console.error('electronAPI not available!');
    setTimeout(() => {
      if (!(window as any).electronAPI) {
        alert('Error: Application API not loaded. Please restart the app.');
      } else {
        initApp();
      }
    }, 500);
    return;
  }
  
  initApp();
});

function initApp() {
  const api = (window as any).electronAPI;
  console.log('Initializing app...');
  console.log('electronAPI:', api);
  
  const fileInputArea = document.getElementById('fileInputArea')!;
  const addFilesBtn = document.getElementById('addFilesBtn')!;
  const fileList = document.getElementById('fileList')!;
  const corruptionOptions = document.getElementById('corruptionOptions')!;
  const processBtn = document.getElementById('processBtn') as HTMLButtonElement;
  const progressSection = document.getElementById('progressSection')!;
  const resultsSection = document.getElementById('resultsSection')!;
  const viewLogsBtn = document.getElementById('viewLogsBtn')!;
  const logModal = document.getElementById('logModal')!;
  const closeLogModal = document.getElementById('closeLogModal')!;
  const refreshLogsBtn = document.getElementById('refreshLogsBtn')!;
  const openLogFolderBtn = document.getElementById('openLogFolderBtn')!;
  const logContent = document.getElementById('logContent')!;

  // Listen for menu "Add Files" action
  window.addEventListener('menu-add-files', ((e: CustomEvent<string[]>) => {
    addFiles(e.detail);
  }) as EventListener);

  // Setup individual slider value displays
  const sliders = document.querySelectorAll('.option-slider .level-slider') as NodeListOf<HTMLInputElement>;
  sliders.forEach(slider => {
    const valueDisplay = slider.nextElementSibling as HTMLElement;
    slider.oninput = function() {
      valueDisplay.textContent = slider.value;
    };
  });

  // Get level for selected corruption type
  function getSelectedLevel(): number {
    const selected = corruptionOptions.querySelector('input[type="radio"]:checked') as HTMLInputElement;
    const type = selected?.value || 'truncated';
    const slider = document.querySelector(`.level-slider[data-type="${type}"]`) as HTMLInputElement;
    return parseInt(slider?.value || '5', 10);
  }

  // Update process button state
  function updateProcessButton() {
    processBtn.disabled = selectedFiles.length === 0;
  }

  // Update file list UI
  function updateFileList() {
    fileList.innerHTML = '';
    
    if (selectedFiles.length === 0) {
      return;
    }

    selectedFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      
      const fileName = document.createElement('span');
      fileName.className = 'file-item-name';
      fileName.textContent = file.name;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-item-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.onclick = () => {
        selectedFiles.splice(index, 1);
        updateFileList();
        updateProcessButton();
      };
      
      fileItem.appendChild(fileName);
      fileItem.appendChild(removeBtn);
      fileList.appendChild(fileItem);
    });
  }

  // Add files to the list (only valid media files)
  function addFiles(filePaths: string[]) {
    console.log('Adding files:', filePaths);
    const rejectedFiles: string[] = [];
    
    for (const filePath of filePaths) {
      if (!isValidMediaFile(filePath)) {
        const name = filePath.split(/[/\\]/).pop() || filePath;
        rejectedFiles.push(name);
        continue;
      }
      if (!selectedFiles.some(f => f.path === filePath)) {
        const name = filePath.split(/[/\\]/).pop() || filePath;
        selectedFiles.push({ path: filePath, name });
      }
    }
    
    if (rejectedFiles.length > 0) {
      alert(`The following files are not supported media files:\n\n${rejectedFiles.join('\n')}\n\nSupported formats: MP4, AVI, MOV, MKV, WebM, MP3, WAV, FLAC, AAC, M4A, OGG`);
    }
    
    updateFileList();
    updateProcessButton();
  }

  // Open file dialog
  async function openFileDialog() {
    console.log('Opening file dialog...');
    try {
      const result = await api.openFileDialog();
      console.log('Dialog result:', result);
      if (!result.canceled && result.filePaths.length > 0) {
        addFiles(result.filePaths);
      }
    } catch (error) {
      console.error('Error opening dialog:', error);
      alert('Error opening file dialog: ' + (error as Error).message);
    }
  }

  // Button click handler
  addFilesBtn.onclick = function(e) {
    console.log('Button clicked!');
    e.stopPropagation();
    openFileDialog();
  };

  // Drag and drop
  fileInputArea.ondragover = function(e) {
    e.preventDefault();
    fileInputArea.classList.add('drag-over');
  };

  fileInputArea.ondragleave = function(e) {
    e.preventDefault();
    fileInputArea.classList.remove('drag-over');
  };

  fileInputArea.ondrop = function(e) {
    e.preventDefault();
    fileInputArea.classList.remove('drag-over');
    console.log('Drop event');

    if (!e.dataTransfer?.files) {
      return;
    }

    const filePaths: string[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      const path = (file as any).path;
      if (path) {
        filePaths.push(path);
      }
    }
    
    if (filePaths.length > 0) {
      addFiles(filePaths);
    }
  };

  // Process button
  processBtn.onclick = async function() {
    if (selectedFiles.length === 0) return;

    const selected = corruptionOptions.querySelector('input[type="radio"]:checked') as HTMLInputElement;
    const corruptionType = selected?.value || 'truncated';
    const corruptionLevel = getSelectedLevel();
    
    progressSection.style.display = 'block';
    resultsSection.innerHTML = '';
    processBtn.disabled = true;
    
    const results: Array<{ file: string; success: boolean; outputPath: string | null; diagnostics: string | null; error: string | null }> = [];
    
    for (const file of selectedFiles) {
      try {
        const lastSlash = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'));
        const outputDir = lastSlash > 0 ? file.path.substring(0, lastSlash) : '.';
        
        const result = await api.corruptFile(file.path, corruptionType, outputDir, corruptionLevel);
        results.push({
          file: file.name,
          success: result.success,
          outputPath: result.outputPath,
          diagnostics: result.diagnostics || null,
          error: result.error,
        });
      } catch (error: any) {
        results.push({
          file: file.name,
          success: false,
          outputPath: null,
          diagnostics: null,
          error: error.message || 'Unknown error',
        });
      }
    }
    
    progressSection.style.display = 'none';
    processBtn.disabled = false;
    
    // Display results
    results.forEach(result => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `result-message ${result.success ? 'success' : 'error'}`;
      
      const title = document.createElement('div');
      title.className = 'result-message-title';
      title.textContent = result.success 
        ? `✓ Successfully processed: ${result.file}`
        : `✗ Failed to process: ${result.file}`;
      
      const details = document.createElement('div');
      details.className = 'result-message-details';
      
      if (result.success && result.outputPath) {
        const locationText = document.createElement('span');
        locationText.textContent = 'File location: ';
        
        const locationLink = document.createElement('span');
        locationLink.className = 'result-file-link';
        locationLink.textContent = result.outputPath;
        locationLink.onclick = () => {
          api.revealInFolder(result.outputPath!);
        };
        
        details.appendChild(locationText);
        details.appendChild(locationLink);
        
        // Add diagnostics if available (collapsible)
        if (result.diagnostics) {
          const diagnosticsContainer = document.createElement('div');
          diagnosticsContainer.className = 'diagnostics-container';
          diagnosticsContainer.style.marginTop = '8px';
          
          const diagnosticsToggle = document.createElement('button');
          diagnosticsToggle.className = 'diagnostics-toggle';
          diagnosticsToggle.textContent = '▶ View Diagnostics';
          diagnosticsToggle.type = 'button';
          
          const diagnosticsContent = document.createElement('div');
          diagnosticsContent.className = 'diagnostics-content';
          diagnosticsContent.style.display = 'none';
          diagnosticsContent.textContent = result.diagnostics;
          
          diagnosticsToggle.onclick = () => {
            const isExpanded = diagnosticsContent.style.display !== 'none';
            diagnosticsContent.style.display = isExpanded ? 'none' : 'block';
            diagnosticsToggle.textContent = isExpanded ? '▶ View Diagnostics' : '▼ Hide Diagnostics';
          };
          
          diagnosticsContainer.appendChild(diagnosticsToggle);
          diagnosticsContainer.appendChild(diagnosticsContent);
          details.appendChild(diagnosticsContainer);
        }
      } else if (result.error) {
        details.textContent = `Error: ${result.error}`;
      }
      
      messageDiv.appendChild(title);
      messageDiv.appendChild(details);
      resultsSection.appendChild(messageDiv);
    });
  };

  // Log viewer functionality
  async function loadLogs() {
    try {
      const result = await api.getLogFiles();
      if (result.success && result.files.length > 0) {
        // Load the most recent log file
        const logResult = await api.readLogFile(result.files[0]);
        if (logResult.success) {
          logContent.textContent = logResult.content || 'No log entries found.';
        } else {
          logContent.textContent = `Error loading log: ${logResult.error}`;
        }
      } else {
        logContent.textContent = 'No log files found.';
      }
    } catch (error: any) {
      logContent.textContent = `Error: ${error.message}`;
    }
  }

  viewLogsBtn.onclick = async () => {
    logModal.style.display = 'flex';
    await loadLogs();
  };

  closeLogModal.onclick = () => {
    logModal.style.display = 'none';
  };

  refreshLogsBtn.onclick = async () => {
    await loadLogs();
  };

  openLogFolderBtn.onclick = async () => {
    await api.openLogFolder();
  };

  // Close modal when clicking outside
  logModal.onclick = (e) => {
    if (e.target === logModal) {
      logModal.style.display = 'none';
    }
  };

  updateProcessButton();
  console.log('App initialized successfully');
}
