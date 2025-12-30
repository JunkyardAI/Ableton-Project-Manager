// --- MOCK DATA FOR PREVIEW MODE ---
const MOCK_PROJECTS = [
    { id: '1', name: 'Cyberpunk Bass 01', rootFolder: 'D:/Music/Ableton/Cyberpunk Bass 01', status: 'Mixing', tags: ['DnB', 'Heavy'], tasks: [{text: 'Fix sub', done: false}] },
    { id: '2', name: 'Ambient Sketch', rootFolder: 'D:/Music/Ableton/Ambient Sketch', status: 'Idea', tags: ['Chill'], tasks: [] },
    { id: '3', name: 'Techno Rumble', rootFolder: 'D:/Music/Ableton/Techno Rumble', status: 'Incomplete', tags: ['Techno', '130bpm'], tasks: [{text: 'Arrangement', done: true}, {text: 'Mix kick', done: false}] },
];

// --- APP STATE ---
const App = {
    projects: [],
    virtualFolders: [
        { id: 'all', name: 'All Projects', icon: '📂' },
        { id: 'priority', name: 'Priority', icon: '🔥' },
        { id: 'incomplete', name: 'Incomplete', icon: '🚧' }
    ],
    selectedProjectId: null,
    currentFilter: 'all',

    init() {
        // Check if running in Electron or Browser
        if (window.electron) {
            this.projects = []; // Wait for load or import
        } else {
            console.warn("Running in Browser Mode (Mock Data)");
            this.projects = MOCK_PROJECTS;
        }
        
        this.renderSidebar();
        this.renderGrid();
        this.setupListeners();
    },

    // --- RENDERING ---

    renderSidebar() {
        const list = document.getElementById('virtualFolderList');
        list.innerHTML = this.virtualFolders.map(folder => `
            <li class="sidebar-item cursor-pointer px-4 py-2 flex items-center space-x-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition ${this.currentFilter === folder.id ? 'active text-white bg-[#2a2a2a]' : ''}"
                onclick="App.setFilter('${folder.id}', '${folder.name}')">
                <span>${folder.icon}</span>
                <span>${folder.name}</span>
            </li>
        `).join('');
        
        // Mock Tags
        const tags = ['DnB', 'Techno', 'House', 'Ambient'];
        document.getElementById('tagList').innerHTML = tags.map(tag => `
            <li class="cursor-pointer px-4 py-1 text-gray-400 hover:text-[#f59e0b] transition text-xs"># ${tag}</li>
        `).join('');
    },

    renderGrid() {
        const grid = document.getElementById('projectGrid');
        const filtered = this.filterProjects();
        
        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-gray-600 mt-10">No projects found. Try importing some folders.</div>`;
            return;
        }

        grid.innerHTML = filtered.map(p => `
            <div class="glass-panel rounded-lg p-4 cursor-pointer card-hover transition border border-[#333] ${this.selectedProjectId === p.id ? 'border-[#f59e0b] bg-[#252525]' : ''}"
                 onclick="App.selectProject('${p.id}')">
                <div class="h-24 bg-gradient-to-br from-gray-800 to-black rounded mb-3 flex items-center justify-center">
                    <span class="text-2xl opacity-50">🎵</span>
                </div>
                <h3 class="font-bold text-white truncate">${p.name}</h3>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-xs px-2 py-0.5 rounded-full bg-[#333] text-gray-300 border border-[#444]">${p.status}</span>
                    <span class="text-xs text-gray-600">Ableton 11</span>
                </div>
            </div>
        `).join('');
    },

    renderInspector() {
        const content = document.getElementById('inspectorContent');
        const empty = document.getElementById('inspectorEmpty');
        
        if (!this.selectedProjectId) {
            content.style.display = 'none';
            empty.style.display = 'flex';
            return;
        }

        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (!p) return;

        empty.style.display = 'none';
        content.style.display = 'flex';

        document.getElementById('inspectorName').innerText = p.name;
        document.getElementById('inspectorPath').innerText = p.rootFolder;
        document.getElementById('statusSelect').value = p.status;

        // Render Tasks
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = p.tasks.map((t, idx) => `
            <li class="flex items-start space-x-2 group">
                <input type="checkbox" ${t.done ? 'checked' : ''} 
                       class="mt-1 bg-transparent border-gray-600 rounded text-[#f59e0b] focus:ring-0"
                       onchange="App.toggleTask('${p.id}', ${idx})">
                <span class="text-gray-300 text-xs ${t.done ? 'line-through text-gray-600' : ''}">${t.text}</span>
            </li>
        `).join('');

        // Render Tags
        const tagContainer = document.getElementById('inspectorTags');
        tagContainer.innerHTML = p.tags.map(t => `
            <span class="text-xs bg-[#f59e0b] bg-opacity-10 text-[#f59e0b] px-2 py-1 rounded border border-[#f59e0b] border-opacity-20">${t}</span>
        `).join('') + `<button class="text-xs bg-[#333] text-gray-400 px-2 py-1 rounded hover:text-white">+</button>`;
    },

    // --- LOGIC ---

    setFilter(id, name) {
        this.currentFilter = id;
        document.getElementById('currentViewTitle').innerText = name;
        this.renderSidebar();
        this.renderGrid();
    },

    filterProjects() {
        if (this.currentFilter === 'all') return this.projects;
        if (this.currentFilter === 'priority') return this.projects.filter(p => p.tags.includes('Priority')); // Mock logic
        if (this.currentFilter === 'incomplete') return this.projects.filter(p => p.status === 'Incomplete');
        return this.projects;
    },

    selectProject(id) {
        this.selectedProjectId = id;
        this.renderGrid(); // To update active border
        this.renderInspector();
    },

    toggleTask(pid, taskIdx) {
        const p = this.projects.find(x => x.id === pid);
        if (p) {
            p.tasks[taskIdx].done = !p.tasks[taskIdx].done;
            this.renderInspector(); // Re-render to show strikethrough
        }
    },

    // --- IPC / ACTIONS ---

    async importFolder() {
        if (!window.electron) {
            alert("This feature requires the Electron environment.");
            // Add mock project for demo
            this.projects.push({
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
                name: "New Imported Beat",
                rootFolder: "D:/Music/Ableton/New Beat",
                status: "Idea",
                tags: [],
                tasks: []
            });
            this.renderGrid();
            return;
        }

        const result = await window.electron.importFolder();
        if (!result.canceled && result.projects) {
            this.projects = [...this.projects, ...result.projects];
            this.renderGrid();
        }
    },

    async revealInExplorer() {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (p && window.electron) {
            window.electron.revealInExplorer(p.rootFolder);
        }
    },

    async openInAbleton() {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (!p) return;
        
        if (window.electron && p.alsPath) {
            await window.electron.openProject(p.alsPath);
        } else {
            console.log("Opening Ableton for", p.name);
        }
    },

    async renameProject() {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (!p) return;

        const newName = prompt("Enter new folder name (Safe Rename):", p.name);
        if (!newName || newName === p.name) return;

        if (window.electron) {
            const result = await window.electron.renameProjectFolder({
                projectId: p.id,
                oldPath: p.rootFolder,
                newName: newName
            });

            if (result.success) {
                p.rootFolder = result.newRootPath;
                p.name = newName; // Simply updating name for now
                this.renderGrid();
                this.renderInspector();
            } else {
                alert("Rename failed: " + result.error);
            }
        } else {
            // Mock
            p.name = newName;
            this.renderGrid();
            this.renderInspector();
        }
    },

    setupListeners() {
        document.getElementById('importBtn').addEventListener('click', () => this.importFolder());
        document.getElementById('projectPreview').addEventListener('click', () => this.openInAbleton());
        document.getElementById('revealBtn').addEventListener('click', () => this.revealInExplorer());
        document.getElementById('renameBtn').addEventListener('click', () => this.renameProject());
        document.getElementById('searchInput').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            // Simple inline filter for demo
            const allCards = document.querySelectorAll('#projectGrid > div');
            // In a real app, update state and re-render properly
        });
    }
    
};

// Start
App.init();