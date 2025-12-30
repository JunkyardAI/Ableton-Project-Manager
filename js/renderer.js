const App = {
    // --- STATE ---
    projects: [],
    collections: [], // { id, name }
    
    // Default Virtual Folders (System)
    systemFolders: [
        { id: 'all', name: 'All Projects', icon: '<i class="fa-solid fa-layer-group"></i>' },
        { id: 'priority', name: 'Priority', icon: '<i class="fa-solid fa-fire text-orange-500"></i>' },
        { id: 'incomplete', name: 'Incomplete', icon: '<i class="fa-solid fa-wrench"></i>' },
        { id: 'released', name: 'Released', icon: '<i class="fa-solid fa-check-circle text-green-500"></i>' }
    ],

    currentFilter: 'all',
    selectedProjectId: null,
    searchQuery: '',

    // --- INIT ---
    async init() {
        this.checkEnvironment();
        
        if (this.isElectron) {
            const data = await window.electron.loadData();
            // Handle legacy data structure or fresh load
            this.projects = data.projects || (Array.isArray(data) ? data : []);
            this.collections = data.collections || [];
        } else {
            // Mock Data
            this.projects = [
                { id: '1', name: 'Demo Track', rootFolder: 'D:/Music/Demo', status: 'Mixing', tags: ['Techno'], collections: [] },
                { id: '2', name: 'Ambient', rootFolder: 'D:/Music/Ambient', status: 'Idea', tags: [], collections: [] }
            ];
            this.collections = [{ id: 'col1', name: 'EP 2024' }];
        }

        this.renderSidebar();
        this.renderList();
        this.setupListeners();
    },

    checkEnvironment() {
        this.isElectron = !!window.electron;
        const statusEl = document.getElementById('electronStatus');
        if (this.isElectron) {
            statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> Electron Active`;
        }
    },

    save() {
        if (this.isElectron) {
            // Save both projects and collections structure
            window.electron.saveData({
                projects: this.projects,
                collections: this.collections
            });
        }
        this.renderList(); 
    },

    // --- RENDERERS ---

    renderSidebar() {
        // 1. System Folders
        const sysList = document.getElementById('virtualFolderList');
        sysList.innerHTML = this.systemFolders.map(f => `
            <li class="sidebar-item px-5 py-2 cursor-pointer flex items-center gap-3 text-gray-400 transition-colors ${this.currentFilter === f.id ? 'active' : ''}"
                onclick="App.setFilter('${f.id}', '${f.name}')">
                <span class="w-5 text-center">${f.icon}</span>
                <span class="font-medium">${f.name}</span>
            </li>
        `).join('');

        // 2. User Collections (Virtual)
        const colList = document.getElementById('collectionList');
        colList.innerHTML = this.collections.map(c => `
            <li class="sidebar-item px-5 py-2 cursor-pointer flex items-center gap-3 text-gray-400 transition-colors group ${this.currentFilter === c.id ? 'active' : ''}"
                onclick="App.setFilter('${c.id}', '${c.name}')">
                <span class="w-5 text-center"><i class="fa-regular fa-folder"></i></span>
                <span class="font-medium flex-1 truncate">${c.name}</span>
                <i class="fa-solid fa-times opacity-0 group-hover:opacity-100 hover:text-red-500 text-xs px-2" 
                   onclick="event.stopPropagation(); App.deleteCollection('${c.id}')"></i>
            </li>
        `).join('');

        // 3. Tags
        const allTags = new Set();
        this.projects.forEach(p => (p.tags || []).forEach(t => allTags.add(t)));
        
        const tagList = document.getElementById('tagList');
        tagList.innerHTML = Array.from(allTags).filter(t => t !== 'Priority').map(t => `
            <li class="px-2 py-1 text-xs bg-[#252525] text-gray-400 hover:text-white hover:bg-[#333] rounded cursor-pointer border border-[#333]"
                onclick="App.setSearch('${t}')">#${t}</li>
        `).join('');
    },

    renderList() {
        const container = document.getElementById('projectListContainer');
        const filtered = this.filterProjects();
        
        document.getElementById('projectCount').innerText = `${filtered.length} projects`;

        if (filtered.length === 0) {
            container.innerHTML = `<div class="text-center mt-20 text-gray-600 italic">No projects found in this view.</div>`;
            return;
        }

        container.innerHTML = filtered.map(p => {
            const isPriority = (p.tags || []).includes('Priority');
            const isActive = this.selectedProjectId === p.id;
            const displayTags = (p.tags || []).filter(t => t !== 'Priority').slice(0, 3);
            
            return `
            <div class="project-card ${isPriority ? 'priority' : ''} ${isActive ? 'active' : ''}" 
                 onclick="App.selectProject('${p.id}')"
                 ondblclick="App.openProject('${p.id}')">
                
                <div class="card-icon">
                    <i class="fa-brands fa-itunes-note"></i>
                </div>

                <div class="card-info overflow-hidden">
                    <h3 class="truncate">${p.name}</h3>
                    <p>${p.rootFolder}</p>
                </div>

                <div class="hidden md:flex card-tags">
                    ${displayTags.map(t => `<span class="tag-badge">#${t}</span>`).join('')}
                </div>

                <!-- CLICKABLE STATUS BADGE -->
                <div class="status-badge status-${p.status || 'Idea'} cursor-pointer hover:opacity-80 select-none"
                     onclick="event.stopPropagation(); App.cycleStatus('${p.id}')"
                     title="Click to change status">
                    ${p.status || 'Idea'}
                </div>
            </div>
            `;
        }).join('');
    },

    renderInspector() {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        const panel = document.getElementById('inspectorPanel');
        const empty = document.getElementById('inspectorEmpty');
        const content = document.getElementById('inspectorContent');

        if (!p) {
            panel.classList.remove('inspector-open');
            return;
        }

        panel.classList.add('inspector-open');
        empty.classList.add('hidden');
        content.classList.remove('hidden');
        content.classList.add('flex');

        document.getElementById('inspectorName').innerText = p.name;
        document.getElementById('inspectorPath').innerText = p.rootFolder;
        document.getElementById('statusSelect').value = p.status || 'Idea';

        // Priority
        const isPriority = (p.tags || []).includes('Priority');
        const prioBtn = document.getElementById('priorityToggleBtn');
        prioBtn.innerHTML = isPriority 
            ? `<i class="fa-solid fa-star text-orange-500"></i> <span>Priority</span>`
            : `<i class="fa-regular fa-star"></i> <span>Normal</span>`;

        // Tags
        document.getElementById('inspectorTags').innerHTML = (p.tags || []).filter(t => t !== 'Priority').map(t => `
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#333] text-gray-300 text-xs border border-[#444] group">
                #${t} <i class="fa-solid fa-times ml-1 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-red-400" onclick="App.removeTag('${t}')"></i>
            </span>
        `).join('');

        // Collections Dropdown
        const projectCols = p.collections || [];
        document.getElementById('inspectorCollections').innerHTML = this.collections.map(c => {
            const inCol = projectCols.includes(c.id);
            return `
                <div class="flex items-center gap-2 text-xs text-gray-400 p-1 hover:bg-[#252525] rounded cursor-pointer"
                     onclick="App.toggleCollection('${p.id}', '${c.id}')">
                    <i class="fa-${inCol ? 'solid fa-check-square text-green-500' : 'regular fa-square'}"></i>
                    ${c.name}
                </div>
            `;
        }).join('') || '<div class="text-xs text-gray-600">No collections created</div>';

        // Tasks
        document.getElementById('taskList').innerHTML = (p.tasks || []).map((t, i) => `
            <li class="group flex items-start gap-2 text-xs">
                <input type="checkbox" ${t.done ? 'checked' : ''} 
                    class="mt-0.5 bg-[#333] border-gray-600 rounded focus:ring-0 text-amber-500 cursor-pointer"
                    onchange="App.toggleTask(${i})">
                <span class="${t.done ? 'line-through text-gray-600' : 'text-gray-300'} flex-1">${t.text}</span>
                <i class="fa-solid fa-trash text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer" onclick="App.deleteTask(${i})"></i>
            </li>
        `).join('');
    },

    // --- LOGIC ---

    cycleStatus(id) {
        const statuses = ['Idea', 'Incomplete', 'Mixing', 'Mastering', 'Released'];
        const p = this.projects.find(x => x.id === id);
        if (p) {
            const currentIdx = statuses.indexOf(p.status || 'Idea');
            const nextIdx = (currentIdx + 1) % statuses.length;
            p.status = statuses[nextIdx];
            this.save();
            // If inspector is open on this project, update logic there too
            if (this.selectedProjectId === id) {
                 document.getElementById('statusSelect').value = p.status;
            }
        }
    },

    createCollection() {
        const name = prompt("Collection Name (e.g., 'EP 2025', 'Client Work')");
        if (name) {
            this.collections.push({ id: crypto.randomUUID(), name });
            this.save();
            this.renderSidebar();
        }
    },

    deleteCollection(id) {
        if (confirm("Delete this collection? (Projects won't be deleted)")) {
            this.collections = this.collections.filter(c => c.id !== id);
            // Remove ref from projects
            this.projects.forEach(p => {
                if (p.collections) p.collections = p.collections.filter(cid => cid !== id);
            });
            this.save();
            this.setFilter('all', 'All Projects');
        }
    },

    toggleCollection(pid, cid) {
        const p = this.projects.find(x => x.id === pid);
        if (!p) return;
        
        if (!p.collections) p.collections = [];
        
        if (p.collections.includes(cid)) {
            p.collections = p.collections.filter(id => id !== cid);
        } else {
            p.collections.push(cid);
        }
        this.save();
        this.renderInspector(); // Refresh checkboxes
    },

    setFilter(id, name) {
        this.currentFilter = id;
        document.getElementById('currentViewTitle').innerText = name;
        this.renderSidebar();
        this.renderList();
    },

    setSearch(term) {
        document.getElementById('searchInput').value = term;
        this.searchQuery = term.toLowerCase();
        this.renderList();
    },

    selectProject(id) {
        this.selectedProjectId = id;
        this.renderList(); 
        this.renderInspector();
    },

    filterProjects() {
        let res = this.projects;
        
        // System Filters
        if (this.currentFilter === 'priority') res = res.filter(p => (p.tags || []).includes('Priority'));
        else if (this.currentFilter === 'incomplete') res = res.filter(p => p.status === 'Incomplete');
        else if (this.currentFilter === 'released') res = res.filter(p => p.status === 'Released');
        
        // Collection Filters (Dynamic)
        else if (this.currentFilter !== 'all') {
            res = res.filter(p => (p.collections || []).includes(this.currentFilter));
        }

        if (this.searchQuery) {
            res = res.filter(p => 
                p.name.toLowerCase().includes(this.searchQuery) || 
                (p.tags || []).some(t => t.toLowerCase().includes(this.searchQuery))
            );
        }
        return res;
    },

    // --- SETUP LISTENERS ---
    setupListeners() {
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderList();
        });

        document.getElementById('importBtn').onclick = async () => {
            if (!this.isElectron) return alert("Feature available in Desktop App only.");
            const res = await window.electron.importFolder();
            if (!res.canceled && res.project) {
                if (this.projects.some(p => p.rootFolder === res.project.rootFolder)) return alert("Exists!");
                this.projects.push({ id: crypto.randomUUID(), ...res.project, status: 'Idea', tags: [], collections: [] });
                this.save();
            }
        };

        document.getElementById('createColBtn').onclick = () => this.createCollection();
        
        document.getElementById('closeInspectorBtn').onclick = () => {
            this.selectedProjectId = null;
            this.renderList();
            document.getElementById('inspectorPanel').classList.remove('inspector-open');
        };

        document.getElementById('statusSelect').onchange = (e) => {
            const p = this.projects.find(x => x.id === this.selectedProjectId);
            if (p) { p.status = e.target.value; this.save(); this.renderList(); }
        };

        document.getElementById('priorityToggleBtn').onclick = () => {
            const p = this.projects.find(x => x.id === this.selectedProjectId);
            if (!p) return;
            if (!p.tags) p.tags = [];
            
            if (p.tags.includes('Priority')) p.tags = p.tags.filter(t => t !== 'Priority');
            else p.tags.push('Priority');
            
            this.save();
            this.renderInspector();
            this.renderList(); // Update strip on card
        };

        document.getElementById('addTagForm').onsubmit = (e) => {
            e.preventDefault();
            const input = document.getElementById('newTagInput');
            const val = input.value.trim();
            const p = this.projects.find(x => x.id === this.selectedProjectId);
            if (val && p) {
                if (!p.tags) p.tags = [];
                if (!p.tags.includes(val)) {
                    p.tags.push(val);
                    this.save();
                    this.renderInspector();
                    this.renderSidebar();
                }
                input.value = '';
            }
        };

        document.getElementById('addTaskBtn').onclick = () => {
            const p = this.projects.find(x => x.id === this.selectedProjectId);
            if (p) {
                if (!p.tasks) p.tasks = [];
                p.tasks.push({ text: "New Task", done: false });
                this.save();
                this.renderInspector();
            }
        };

        // RENAME LOGIC
        document.getElementById('renameBtn').onclick = async () => {
            const p = this.projects.find(x => x.id === this.selectedProjectId);
            if (!p || !this.isElectron) return;

            const newName = prompt("Rename Project Folder:", p.name);
            if (newName && newName !== p.name) {
                const res = await window.electron.renameProjectFolder({
                    oldPath: p.rootFolder,
                    newName: newName
                });

                if (res.success) {
                    p.rootFolder = res.newPath;
                    p.name = newName;
                    this.save();
                    this.renderInspector();
                    this.renderList();
                } else {
                    alert("Error: " + res.error);
                }
            }
        };

        document.getElementById('revealBtn').onclick = () => {
            const p = this.projects.find(x => x.id === this.selectedProjectId);
            if (p && this.isElectron) window.electron.revealInExplorer(p.rootFolder);
        };

        document.getElementById('openAbletonBtn').onclick = () => {
            const p = this.projects.find(x => x.id === this.selectedProjectId);
            if (p) App.openProject(p.id);
        };
    },

    removeTag(tag) {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (p) {
            p.tags = p.tags.filter(t => t !== tag);
            this.save();
            this.renderInspector();
            this.renderSidebar();
        }
    },

    toggleTask(idx) {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (p && p.tasks[idx]) {
            p.tasks[idx].done = !p.tasks[idx].done;
            this.save();
            this.renderInspector();
        }
    },

    deleteTask(idx) {
        const p = this.projects.find(x => x.id === this.selectedProjectId);
        if (p) {
            p.tasks.splice(idx, 1);
            this.save();
            this.renderInspector();
        }
    },

    openProject(id) {
        const p = this.projects.find(x => x.id === id);
        if (!p) return;
        if (this.isElectron) {
            const target = p.alsPath || p.rootFolder;
            window.electron.openProject(target);
        } else {
            console.log("Mock Open: " + p.name);
        }
    }
};

App.init();
