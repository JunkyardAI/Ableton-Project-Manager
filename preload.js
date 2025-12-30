const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // File System Actions
    importFolder: () => ipcRenderer.invoke('dialog:open-folder'),
    revealInExplorer: (path) => ipcRenderer.invoke('os:reveal', path),
    openProject: (path) => ipcRenderer.invoke('os:open-project', path),
    
    // Mutations
    renameProjectFolder: (data) => ipcRenderer.invoke('fs:rename-project', data),
    
    // Listeners (for File Watcher updates)
    onProjectChanged: (callback) => ipcRenderer.on('project-changed', callback),
    
    // System Info
    platform: process.platform
});