// Global Error Handler para atrapar y mostrar cualquier error de Javascript en pantalla
window.onerror = function(message, source, lineno, colno, error) {
    showToast(`JS Error: ${message}`, 'error');
    return false;
};
window.onunhandledrejection = function(event) {
    showToast(`Promise Error: ${event.reason}`, 'error');
};

// Toasts
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ph-info';
    if(type === 'success') icon = 'ph-check-circle';
    if(type === 'error') icon = 'ph-warning-circle';
    
    toast.innerHTML = `<i class="ph-fill ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3300);
}

// Theme Toggle
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-theme');
    const isLight = body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    const icon = document.querySelector('#btn-theme-toggle i');
    if(icon) icon.className = isLight ? 'ph ph-moon' : 'ph ph-sun';
    
    // Update Particles background
    if (window.tsParticles) {
        const pJS = tsParticles.domItem(0);
        if (pJS) {
            pJS.options.background.color.value = isLight ? "#F8FAFC" : "#0F172A";
            pJS.refresh();
        }
    }
    
    // Update Graph colors if exists
    if (typeof updateGraphTheme === 'function') {
        updateGraphTheme(isLight);
    }
}

// Check theme and tour on load
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        toggleTheme();
    }
    
    setTimeout(() => {
        if (!localStorage.getItem('tour_completed')) {
            // startGlobalTour(); // Comentado para deshabilitar el recorrido sin borrar el código
            localStorage.setItem('tour_completed', 'true');
        }
    }, 1500);
});

// Intro.js Tour
window.startGlobalTour = function() {
    if (typeof introJs !== 'function') {
        showToast('Tour interactivo no disponible aún', 'warning');
        return;
    }
    introJs().setOptions({
        nextLabel: 'Siguiente',
        prevLabel: 'Atrás',
        skipLabel: 'Saltar Tour',
        doneLabel: '¡Empezar!',
        tooltipPosition: 'auto',
        showProgress: true,
        showBullets: false
    }).start();
};

let currentProjectId = null;
let currentActivities = [];
let currentDependencies = [];

// Navigation
document.getElementById('btn-projects').addEventListener('click', () => {
    switchView('view-projects');
    if (typeof disconnectWebSocket === 'function') disconnectWebSocket();
    loadProjects();
});

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabId === 'tab-graph') {
        renderGraph();
    } else if (tabId === 'tab-gantt') {
        renderGantt();
    }
}

// Modals
function showModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Projects
async function loadProjects() {
    try {
        const projects = await api.getProjects();
        const list = document.getElementById('projects-list');
        list.innerHTML = '';
        
        if (projects.length === 0) {
            list.style.display = 'block';
            list.innerHTML = `
                <div class="empty-state">
                    <i class="ph-duotone ph-folder-dashed empty-state-icon"></i>
                    <h3>Aún no tienes proyectos</h3>
                    <p>Crea tu primer proyecto para empezar a modelar redes y analizar algoritmos.</p>
                    <button class="btn primary mt-2" onclick="showModal('modal-project')">
                        <i class="ph ph-plus-circle"></i> Crear Proyecto
                    </button>
                </div>
            `;
        } else {
            list.style.display = 'grid';
            projects.forEach(p => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="card-header">
                        <div class="card-title">
                            <i class="ph-duotone ph-folder text-primary"></i>
                            <h3>${p.name}</h3>
                        </div>
                        <button class="btn danger small" onclick="deleteProject(${p.id}, event)" title="Eliminar">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                    <p class="text-muted" style="margin-bottom: 1.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.description || 'Sin descripción'}</p>
                    <div>
                        <button class="btn secondary w-100" onclick="openProject(${p.id}, '${p.name}')">
                            Abrir Proyecto <i class="ph ph-arrow-right"></i>
                        </button>
                    </div>
                `;
                list.appendChild(card);
            });
        }
    } catch (e) {
        console.error("Error loading projects", e);
    }
}

async function submitProject() {
    const name = document.getElementById('proj-name').value;
    const desc = document.getElementById('proj-desc').value;
    if(!name) return showToast('Nombre requerido', 'error');
    
    try {
        await api.createProject({name, description: desc});
        showToast('Proyecto guardado correctamente.', 'success');
        closeModal('modal-project');
        loadProjects();
    } catch (e) {
        showToast('Error al guardar proyecto: ' + e.message, 'error');
    }
}

async function deleteProject(id, event) {
    event.stopPropagation();
    if(confirm('¿Eliminar proyecto?')) {
        await api.deleteProject(id);
        loadProjects();
    }
}

// Detail
async function openProject(id, name) {
    currentProjectId = id;
    document.getElementById('current-project-name').textContent = name;
    switchView('view-project-detail');
    switchTab('tab-activities');
    await refreshProjectData();
    if (typeof connectWebSocket === 'function') connectWebSocket(id);
}

async function refreshProjectData() {
    currentActivities = await api.getActivities(currentProjectId);
    currentDependencies = await api.getDependencies(currentProjectId);
    renderActivities();
    renderDependencies();
    updateSelects();
    if (typeof renderGraph === 'function' && document.getElementById('tab-graph').classList.contains('active')) {
        renderGraph();
    }
}
window.loadProjectDetail = refreshProjectData;

// Activities
function renderActivities() {
    const body = document.getElementById('activities-table-body');
    body.innerHTML = `
        <tbody>
            ${currentActivities.map(a => `
                <tr>
                    <td>${a.name}</td>
                    <td>${a.duration}</td>
                    <td>${a.cost}</td>
                    <td>
                        <button class="btn secondary small" onclick="editActivity(${a.id})" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn danger small" onclick="deleteActivity(${a.id})" title="Eliminar"><i class="ph ph-trash"></i></button>
                    </td>
                </tr>
            `).join('')}
        </tbody>`;
}

function resetActivityModal() {
    document.getElementById('act-id').value = '';
    document.getElementById('act-name').value = '';
    document.getElementById('act-duration').value = '0';
    document.getElementById('act-cost').value = '0';
    showModal('modal-activity');
}

function editActivity(id) {
    const act = currentActivities.find(a => a.id === id);
    if (!act) return;
    
    document.getElementById('act-id').value = act.id;
    document.getElementById('act-name').value = act.name;
    document.getElementById('act-duration').value = act.duration;
    document.getElementById('act-cost').value = act.cost;
    
    showModal('modal-activity');
}

async function submitActivity() {
    const id = document.getElementById('act-id').value;
    const name = document.getElementById('act-name').value;
    const duration = parseFloat(document.getElementById('act-duration').value);
    const cost = parseFloat(document.getElementById('act-cost').value);
    if(!name) return showToast('Nombre requerido', 'error');

    try {
        if (id) {
            await api.updateActivity(id, {name, duration, cost});
            showToast('Actividad actualizada correctamente.', 'success');
        } else {
            await api.createActivity(currentProjectId, {name, duration, cost});
            showToast('Actividad guardada correctamente.', 'success');
        }
        closeModal('modal-activity');
        await refreshProjectData();
        if (typeof broadcastDataUpdate === 'function') broadcastDataUpdate();
    } catch (e) {
        showToast('Error al guardar actividad: ' + e.message, 'error');
    }
}

async function deleteActivity(id) {
    if(confirm('¿Eliminar actividad?')) {
        await api.deleteActivity(id);
        showToast('Actividad eliminada.', 'success');
        await refreshProjectData();
        if (typeof broadcastDataUpdate === 'function') broadcastDataUpdate();
    }
}

// Dependencies
function renderDependencies() {
    const body = document.getElementById('dependencies-table-body');
    body.innerHTML = `
            <tbody>
                ${currentDependencies.map(d => {
                    const fromAct = currentActivities.find(a => a.id === d.from_activity_id);
                    const toAct = currentActivities.find(a => a.id === d.to_activity_id);
                    return `
                        <tr>
                            <td>${fromAct ? fromAct.name : d.from_activity_id}</td>
                            <td>${toAct ? toAct.name : d.to_activity_id}</td>
                            <td>${d.weight}</td>
                            <td>${d.time}</td>
                            <td>${d.capacity}</td>
                            <td>
                                <button class="btn secondary small" onclick="editDependency(${d.id})" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                                <button class="btn danger small" onclick="deleteDependency(${d.id})" title="Eliminar"><i class="ph ph-trash"></i></button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>`;
}

function updateSelects() {
    const selects = ['dep-from', 'dep-to', 'algo-source', 'algo-target'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = currentActivities.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    });
}

function resetDependencyModal() {
    document.getElementById('dep-id').value = '';
    document.getElementById('dep-weight').value = '1';
    document.getElementById('dep-time').value = '0';
    document.getElementById('dep-capacity').value = '1';
    document.getElementById('modal-dependency').classList.add('active');
}

function editDependency(id) {
    const dep = currentDependencies.find(d => d.id === id);
    if (!dep) return;
    
    const fromSelect = document.getElementById('dep-from');
    const toSelect = document.getElementById('dep-to');
    fromSelect.innerHTML = currentActivities.map(a => `<option value="${a.id}" ${a.id === dep.from_activity_id ? 'selected' : ''}>${a.name}</option>`).join('');
    toSelect.innerHTML = currentActivities.map(a => `<option value="${a.id}" ${a.id === dep.to_activity_id ? 'selected' : ''}>${a.name}</option>`).join('');
    
    // Disable selects because changing origin/dest usually means it's a completely different edge
    fromSelect.disabled = true;
    toSelect.disabled = true;

    document.getElementById('dep-id').value = dep.id;
    document.getElementById('dep-weight').value = dep.weight;
    document.getElementById('dep-time').value = dep.time;
    document.getElementById('dep-capacity').value = dep.capacity;
    
    document.getElementById('modal-dependency').classList.add('active');
}

// Override closeModal to re-enable selects
const originalCloseModal = window.closeModal;
window.closeModal = function(id) {
    if(id === 'modal-dependency') {
        document.getElementById('dep-from').disabled = false;
        document.getElementById('dep-to').disabled = false;
    }
    document.getElementById(id).classList.remove('active');
}

async function submitDependency() {
    const id = document.getElementById('dep-id').value;
    const from_activity_id = parseInt(document.getElementById('dep-from').value);
    const to_activity_id = parseInt(document.getElementById('dep-to').value);
    const weight = parseFloat(document.getElementById('dep-weight').value);
    const time = parseFloat(document.getElementById('dep-time').value);
    const capacity = parseFloat(document.getElementById('dep-capacity').value);

    if(from_activity_id === to_activity_id) return showToast('No puede depender de sí misma', 'error');

    try {
        if (id) {
            // Edit
            await api.updateDependency(id, {weight, time, capacity});
            showToast('Dependencia actualizada correctamente.', 'success');
        } else {
            // Create
            await api.createDependency(currentProjectId, {from_activity_id, to_activity_id, weight, time, capacity});
            showToast('Dependencia guardada correctamente.', 'success');
        }
        closeModal('modal-dependency');
        await refreshProjectData();
        if (typeof broadcastDataUpdate === 'function') broadcastDataUpdate();
    } catch (e) {
        showToast('Error al guardar dependencia: ' + e.message, 'error');
    }
}

async function deleteDependency(id) {
    if(confirm('¿Eliminar dependencia?')) {
        await api.deleteDependency(id);
        await refreshProjectData();
        if (typeof broadcastDataUpdate === 'function') broadcastDataUpdate();
    }
}

// Init
loadProjects();

// Initialize Particles
tsParticles.load("tsparticles", {
    fpsLimit: 60,
    background: {
        color: {
            value: document.body.classList.contains('light-theme') ? "#F8FAFC" : "#0F172A",
        },
    },
    particles: {
        number: {
            value: 40,
            density: {
                enable: true,
                value_area: 800
            }
        },
        color: {
            value: ["#3B82F6", "#8B5CF6"]
        },
        links: {
            enable: true,
            distance: 180,
            color: "#64748B",
            opacity: 0.15,
            width: 1
        },
        move: {
            enable: true,
            speed: 0.4,
            direction: "none",
            random: true,
            straight: false,
            outModes: {
                default: "bounce"
            }
        },
        size: {
            value: { min: 1, max: 2.5 }
        },
        opacity: {
            value: 0.3
        }
    },
    interactivity: {
        events: {
            onHover: {
                enable: true,
                mode: "grab"
            },
            onClick: {
                enable: true,
                mode: "push"
            }
        },
        modes: {
            grab: {
                distance: 140,
                links: {
                    opacity: 0.4,
                    color: "#3B82F6"
                }
            },
            push: {
                quantity: 1
            }
        }
    },
    detectRetina: true
});

// --- Excel/CSV Import ---
async function importExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!currentProjectId) {
        showToast('Abre un proyecto primero para importar actividades', 'warning');
        return;
    }

    showToast('Procesando archivo...', 'info');
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            if (json.length === 0) {
                showToast('El archivo está vacío', 'error');
                return;
            }

            // Identificar tipo de formato del Excel
            const firstRow = json[0] || {};
            const isEdgeBased = firstRow.hasOwnProperty('Origen') || firstRow.hasOwnProperty('Desde') || firstRow.hasOwnProperty('From');
            
            const createdActivities = {};

            if (isEdgeBased) {
                showToast('Formato de Red (Aristas) detectado. Creando nodos y conexiones...', 'info');
                // 1. Recolectar Nodos Únicos
                const uniqueNodes = new Set();
                for (const row of json) {
                    const from = row['Origen'] || row['Desde'] || row['From'];
                    const to = row['Destino'] || row['Hasta'] || row['To'];
                    if (from !== undefined) uniqueNodes.add(String(from).trim());
                    if (to !== undefined) uniqueNodes.add(String(to).trim());
                }
                
                if(uniqueNodes.size === 0) {
                    showToast('No se encontraron columnas válidas de Origen/Destino', 'error');
                    return;
                }

                // 2. Crear Nodos
                for (const nodeName of uniqueNodes) {
                    const created = await api.createActivity(currentProjectId, {
                        name: nodeName, duration: 0, cost: 0
                    });
                    createdActivities[nodeName] = created;
                }

                // 3. Crear Conexiones
                for (const row of json) {
                    const from = row['Origen'] || row['Desde'] || row['From'];
                    const to = row['Destino'] || row['Hasta'] || row['To'];
                    if (from === undefined || to === undefined) continue;
                    
                    const cost = parseFloat(row['Costo'] || row['Peso'] || row['Cost'] || row['Weight'] || 1);
                    const time = parseFloat(row['Tiempo'] || row['Time'] || 0);
                    const capacity = parseFloat(row['Capacidad'] || row['Capacity'] || 1);
                    
                    const sourceAct = createdActivities[String(from).trim()];
                    const targetAct = createdActivities[String(to).trim()];
                    
                    if (sourceAct && targetAct) {
                        await api.createDependency(currentProjectId, {
                            from_activity_id: sourceAct.id,
                            to_activity_id: targetAct.id,
                            weight: isNaN(cost) ? 1 : cost,
                            time: isNaN(time) ? 0 : time,
                            capacity: isNaN(capacity) ? 1 : capacity
                        });
                    }
                }
            } else {
                showToast('Formato de Gantt/Actividades detectado. Creando tareas...', 'info');
                // 1. Crear todas las actividades
                for (const row of json) {
                    const name = row['Nombre'] || row['Actividad'] || row['Name'] || row['Node'] || row['Nodo'];
                    if (!name) continue;
                    
                    const duration = parseFloat(row['Duracion'] || row['Duración'] || row['Duration'] || 0);
                    const cost = parseFloat(row['Costo'] || row['Cost'] || 0);

                    const created = await api.createActivity(currentProjectId, {
                        name: String(name).trim(),
                        duration: isNaN(duration) ? 0 : duration,
                        cost: isNaN(cost) ? 0 : cost
                    });
                    createdActivities[created.name] = created;
                }

                if (Object.keys(createdActivities).length === 0) {
                    showToast('No se encontraron columnas válidas (Nombre, Actividad, Origen, etc.)', 'warning');
                    return;
                }

                // 2. Crear las dependencias (Predecesoras)
                for (const row of json) {
                    const name = row['Nombre'] || row['Actividad'] || row['Name'] || row['Node'] || row['Nodo'];
                    if (!name) continue;
                    const targetAct = createdActivities[String(name).trim()];
                    if (!targetAct) continue;

                    const predsStr = row['Predecesoras'] || row['Predecessors'] || row['Dependencias'];
                    if (predsStr) {
                        const preds = String(predsStr).split(',').map(s => s.trim());
                        for (const p of preds) {
                            const sourceAct = createdActivities[p];
                            if (sourceAct) {
                                await api.createDependency(currentProjectId, {
                                    from_activity_id: sourceAct.id,
                                    to_activity_id: targetAct.id,
                                    weight: 1,
                                    time: 0,
                                    capacity: 1
                                });
                            }
                        }
                    }
                }
            }

            showToast('¡Importación completada con éxito!', 'success');
            await loadProjectData();
            
        } catch (error) {
            console.error(error);
            showToast('Error procesando el archivo: ' + error.message, 'error');
        }
        
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}
