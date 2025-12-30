const App = {
    projects: [],
    virtualFolders: [
        { id: 'all', name: 'All Projects', icon: '📂' },
        { id: 'priority', name: 'Priority', icon: '🔥' },
        { id: 'incomplete', name: 'Incomplete', icon: '🚧' }
    ],
    selectedProjectId: null,
    currentFilter: 'all',

    async init() {
        // Check if we are in Electron (window.electron exposed by preload.js)
        if (window.electron) {
            console.log("Electron detected. Loading DB...");
            this.projects = await window.electron.loadData();
        } else {
            console.warn("Browser mode: Using empty state.");
            this.projects = []; 
        }
        
        this.renderSidebar();
        this.renderGrid();
        this.setupListeners();
    },

    save() {
        if (window.electron) {
            window.electron.saveData(this.projects);
        }
        this.renderGrid(); // Refresh UI to show status changes immediately
    },

    renderSidebar() {
        const list = document.getElementById('virtualFolderList');
        if (!list) return;

        list.innerHTML = this.virtualFolders.map(folder => `
            <li class="sidebar-item cursor-pointer px-4 py-2 flex items-center space-x-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition ${this.currentFilter === folder.id ? 'active text-white bg-[#2a2a2a]' : ''}"
                onclick="App.setFilter('${folder.id}', '${folder.name}')">
                <span>${folder.icon}</span>
                <span>${folder.name}</span>
            </li>
        `).join('');
        
        // Dynamic Tag List from actual projects
        const allTags = new Set(this.projects.flatMap(p => p.tags || []));
        const tagListEl = document.getElementById('tagList');
        if (tagListEl) {
            tagListEl.innerHTML = Array.from(allTags).map(tag => `
                <li class="cursor-pointer px-4 py-1 text-gray-400 hover:text-[#f59e0b] transition text-xs"># ${tag}</li>
            `).join('');
        }
    },

    renderGrid() {
        const grid = document.getElementById('projectGrid');
        if (!grid) return;

        const filtered = this.filterProjects();
        
        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-gray-600 mt-10">No projects found. Import one to start.</div>`;
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
                    <span class="text-xs px-2 py-0.5 rounded-full bg-[#333] text-gray-300 border border-[#444]">${p.status || 'Idea'}</span>
                </div>
            </div>
        `).join('');
    },

    renderInspector() {
        const content = document.getElementById('inspectorContent');
        const empty = document.getElementById('inspectorEmpty');
        
        if (!this.selectedProjectId) {
            if (content) content.style.display = 'none';
            if (empty) empty.style.display = 'flex';
            return;
        }

        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (!p) return;

        if (empty) empty.style.display = 'none';
        if (content) content.style.display = 'flex';

        const els = {
            name: document.getElementById('inspectorName'),
            path: document.getElementById('inspectorPath'),
            status: document.getElementById('statusSelect'),
            tasks: document.getElementById('taskList'),
            tags: document.getElementById('inspectorTags')
        };

        if (els.name) els.name.innerText = p.name;
        if (els.path) els.path.innerText = p.rootFolder;
        if (els.status) {
            els.status.value = p.status || 'Idea';
            els.status.onchange = (e) => {
                p.status = e.target.value;
                this.save();
            };
        }

        // Tasks
        if (els.tasks) {
            els.tasks.innerHTML = (p.tasks || []).map((t, idx) => `
                <li class="flex items-start space-x-2 group">
                    <input type="checkbox" ${t.done ? 'checked' : ''} 
                           class="mt-1 bg-transparent border-gray-600 rounded text-[#f59e0b] focus:ring-0"
                           onchange="App.toggleTask('${p.id}', ${idx})">
                    <span class="text-gray-300 text-xs ${t.done ? 'line-through text-gray-600' : ''}">${t.text}</span>
                </li>
            `).join('');
        }

        // Tags
        if (els.tags) {
            els.tags.innerHTML = (p.tags || []).map(t => `
                <span class="text-xs bg-[#f59e0b] bg-opacity-10 text-[#f59e0b] px-2 py-1 rounded border border-[#f59e0b] border-opacity-20">${t}</span>
            `).join('') + `<button onclick="App.addTag()" class="text-xs bg-[#333] text-gray-400 px-2 py-1 rounded hover:text-white">+</button>`;
        }
    },

    setFilter(id, name) {
        this.currentFilter = id;
        const title = document.getElementById('currentViewTitle');
        if (title) title.innerText = name;
        this.renderSidebar();
        this.renderGrid();
    },

    filterProjects() {
        if (this.currentFilter === 'all') return this.projects;
        if (this.currentFilter === 'priority') return this.projects.filter(p => (p.tags || []).includes('Priority'));
        if (this.currentFilter === 'incomplete') return this.projects.filter(p => p.status === 'Incomplete');
        return this.projects;
    },

    selectProject(id) {
        this.selectedProjectId = id;
        this.renderGrid(); 
        this.renderInspector();
    },

    toggleTask(pid, taskIdx) {
        const p = this.projects.find(x => x.id === pid);
        if (p) {
            p.tasks[taskIdx].done = !p.tasks[taskIdx].done;
            this.save();
            this.renderInspector();
        }
    },
    
    async addTag() {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if(!p) return;
        const tag = prompt("New Tag:");
        if(tag) {
            if(!p.tags) p.tags = [];
            p.tags.push(tag);
            this.save();
            this.renderInspector();
            this.renderSidebar();
        }
    },

    async importFolder() {
        if (!window.electron) return alert("Electron required for file system access.");
        
        const result = await window.electron.importFolder();
        if (!result.canceled && result.project) {
            const newP = {
                id: crypto.randomUUID(),
                ...result.project,
                status: 'Idea',
                tags: [],
                tasks: []
            };
            this.projects.push(newP);
            this.save();
        }
    },

    async revealInExplorer() {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (p && window.electron) window.electron.revealInExplorer(p.rootFolder);
    },

    async openInAbleton() {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (p && window.electron && p.alsPath) window.electron.openProject(p.alsPath);
    },

    async renameProject() {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (!p || !window.electron) return;

        const newName = prompt("Rename Folder:", p.name);
        if (!newName || newName === p.name) return;

        const result = await window.electron.renameProjectFolder({
            oldPath: p.rootFolder,
            newName: newName
        });

        if (result.success) {
            p.rootFolder = result.newPath;
            p.name = newName;
            this.save();
            this.renderInspector();
        } else {
            alert("Rename failed: " + result.error);
        }
    },

    setupListeners() {
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        };

        bind('importBtn', () => this.importFolder());
        bind('projectPreview', () => this.openInAbleton());
        bind('revealBtn', () => this.revealInExplorer());
        bind('renameBtn', () => this.renameProject());
        bind('addTaskBtn', () => {
             const p = this.projects.find(x => x.id === this.selectedProjectId);
             if(p) {
                 const t = prompt("Task:");
                 if(t) {
                     if(!p.tasks) p.tasks = [];
                     p.tasks.push({text: t, done: false});
                     this.save();
                     this.renderInspector();
                 }
             }
        });
    }
};

App.init();
