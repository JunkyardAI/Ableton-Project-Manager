const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const chokidar = require('chokidar');
const crypto = require('crypto');

// State Management (In a real app, use SQLite or lowdb)
let mainWindow;
let projectRegistry = {
    projects: {}, // Map<id, Project>
    virtualFolders: {
        'Unsorted': [],
        'Priority': [],
        'Sound Design': []
    }
};

// --- Window Creation ---
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#1e1e1e',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false // Needed for some fs operations if not fully proxied
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    
    // Load persisted data (Mock)
    // loadData(); 
});

// --- File System Logic ---

// Helper: Recursively scan for .als files
async function scanForProjects(dirPath) {
    let results = [];
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        // Check if this specific folder is an Ableton Project (contains .als)
        const alsFiles = entries.filter(e => e.isFile() && e.name.endsWith('.als'));
        
        if (alsFiles.length > 0) {
            // It's a project folder. Add the first .als as the entry point
            // In reality, you might want to pick the most recently modified one
            const mainAls = alsFiles[0];
            const stats = await fs.stat(path.join(dirPath, mainAls.name));
            
            results.push({
                path: path.join(dirPath, mainAls.name),
                rootFolder: dirPath,
                name: path.basename(dirPath), // Use folder name as project name
                modified: stats.mtime
            });
            // Don't recurse deeper into a project folder to find backups/samples
            return results; 
        }

        // Recurse subdirectories
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subResults = await scanForProjects(path.join(dirPath, entry.name));
                results = results.concat(subResults);
            }
        }
    } catch (err) {
        console.error("Scan error:", err);
    }
    return results;
}

// --- IPC Handlers ---

// 1. Open Folder Dialog & Import
ipcMain.handle('dialog:open-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    
    if (canceled) return { canceled: true };
    
    const rootPath = filePaths[0];
    const scannedProjects = await scanForProjects(rootPath);
    
    // Process results into Virtual Registry
    const newProjects = scannedProjects.map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        alsPath: p.path,
        rootFolder: p.rootFolder,
        tags: [],
        status: 'Incomplete',
        tasks: [],
        lastModified: p.modified
    }));

    return { canceled: false, projects: newProjects };
});

// 2. Open Project in OS (Ableton)
ipcMain.handle('os:open-project', async (event, filePath) => {
    // shell.openPath opens the file with the default associated app
    const result = await shell.openPath(filePath);
    return result; // returns string error or empty string on success
});

// 3. Safe Rename (Renames the root folder on Disk)
ipcMain.handle('fs:rename-project', async (event, { projectId, oldPath, newName }) => {
    try {
        const parentDir = path.dirname(oldPath);
        const newPath = path.join(parentDir, newName);
        
        // Check if destination exists
        try {
            await fs.access(newPath);
            return { success: false, error: 'Destination already exists.' };
        } catch (e) {
            // Good, it doesn't exist
        }

        // Rename on Disk
        await fs.rename(oldPath, newPath);

        // Calculate new ALS path (assuming .als was renamed or just folder?)
        // Ableton usually keeps .als name same as folder, but not always.
        // For safety in this MVP, we only rename the FOLDER.
        // The .als file path inside needs to be re-resolved or we assume user didn't rename .als file manually.
        
        // Return new paths to update UI
        return { success: true, newRootPath: newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 4. Reveal in Finder/Explorer
ipcMain.handle('os:reveal', async (event, fullPath) => {
    shell.showItemInFolder(fullPath);
});