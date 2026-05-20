let network = null;
let nodesDS = null;
let edgesDS = null;

let animatedEdges = [];
let animationOffset = 0;
let animationReqId = null;

let currentGraphThemeLight = document.body.classList.contains('light-theme');

function getBaseTooltipHTML(a) {
    return `<div class="vis-tooltip-title"><i class="ph-fill ph-check-circle"></i> ${a.name}</div>
            <div class="vis-tooltip-row"><strong><i class="ph ph-clock"></i> Duración:</strong> <span>${a.duration}</span></div>
            <div class="vis-tooltip-row"><strong><i class="ph ph-currency-dollar"></i> Costo:</strong> <span>$${a.cost}</span></div>`;
}

function getCPMTooltipHTML(info) {
    return `<hr style="margin: 8px 0; border-color: var(--border);">
            <div class="vis-tooltip-row" style="font-size:0.8rem"><strong>ES:</strong> <span>${info.ES}</span> &nbsp;|&nbsp; <strong>EF:</strong> <span>${info.EF}</span></div>
            <div class="vis-tooltip-row" style="font-size:0.8rem"><strong>LS:</strong> <span>${info.LS}</span> &nbsp;|&nbsp; <strong>LF:</strong> <span>${info.LF}</span></div>
            <div class="vis-tooltip-row" style="margin-top:4px"><strong><i class="ph ph-arrows-out-line-horizontal"></i> Holgura:</strong> <span>${info.slack}</span></div>`;
}

function htmlTitle(html) {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
}

function getThemeColors() {
    return {
        bg: currentGraphThemeLight ? '#FFFFFF' : '#1E293B',
        border: currentGraphThemeLight ? '#4F46E5' : '#3B82F6',
        font: currentGraphThemeLight ? '#0F172A' : '#F8FAFC',
        stroke: currentGraphThemeLight ? '#F8FAFC' : '#0F172A',
        hlBg: currentGraphThemeLight ? '#EEF2FF' : '#3B82F6',
        hlBorder: currentGraphThemeLight ? '#4338CA' : '#60A5FA',
        edge: currentGraphThemeLight ? '#9ca3af' : '#475569',
        redBg: currentGraphThemeLight ? '#fee2e2' : '#7f1d1d',
        redBorder: currentGraphThemeLight ? '#ef4444' : '#ef4444',
        redFont: currentGraphThemeLight ? '#991b1b' : '#fca5a5',
        exportBg: currentGraphThemeLight ? '#F8FAFC' : '#0F172A',
        shadow: currentGraphThemeLight ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.5)'
    };
}

function updateGraphTheme(isLight) {
    currentGraphThemeLight = isLight;
    if (!nodesDS) return;
    const colors = getThemeColors();
    
    const updates = [];
    nodesDS.forEach(n => {
        if (!n.color || n.color.background !== colors.redBg) {
            updates.push({
                id: n.id,
                color: { background: colors.bg, border: colors.border, highlight: { background: colors.hlBg, border: colors.hlBorder } },
                font: { color: colors.font, strokeColor: colors.stroke }
            });
        }
    });
    nodesDS.update(updates);
    
    // Update edges
    const edgeUpdates = [];
    edgesDS.forEach(e => {
        if (!e.color || e.color.color !== colors.redBorder) {
            edgeUpdates.push({
                id: e.id,
                color: { color: colors.edge },
                font: { color: colors.font, strokeColor: colors.stroke }
            });
        }
    });
    edgesDS.update(edgeUpdates);
    
    network.setOptions({
        nodes: {
            shadow: { color: colors.shadow }
        }
    });
}

const algoOptions = {
    mst: [
        {value: 'prim', label: 'Prim'},
        {value: 'kruskal', label: 'Kruskal'}
    ],
    shortest: [
        {value: 'dijkstra', label: 'Dijkstra'},
        {value: 'bellman-ford', label: 'Bellman-Ford'},
        {value: 'floyd-warshall', label: 'Floyd-Warshall'},
        {value: 'a*', label: 'A*'}
    ],
    flow: [
        {value: 'ford-fulkerson', label: 'Ford-Fulkerson'}
    ],
    pm: [
        {value: 'cpm', label: 'CPM (Ruta Crítica)'},
        {value: 'pert', label: 'PERT'}
    ]
};

const algoDescriptions = {
    'prim': 'Conecta todos los nodos de la red al menor costo posible. Empieza desde un nodo y siempre busca la conexión más barata disponible.',
    'kruskal': 'También conecta toda la red al menor costo, pero lo hace ordenando primero todas las conexiones (de la más barata a la más cara) y uniéndolas sin formar ciclos.',
    'dijkstra': 'Encuentra la ruta más corta (o de menor costo) desde el Nodo Origen hacia el Nodo Destino. Solo funciona si todos los costos son positivos.',
    'bellman-ford': 'Busca la ruta más corta permitiendo costos negativos. Es un poco más lento que Dijkstra, pero más seguro en redes complejas.',
    'floyd-warshall': 'Calcula la distancia mínima entre TODOS los pares de nodos al mismo tiempo. Genera una tabla con todos los resultados. Ideal para redes pequeñas.',
    'a*': 'Es una versión inteligente de Dijkstra. Usa una "intuición" o heurística para buscar en la dirección correcta hacia el destino y encontrar la ruta más rápido.',
    'ford-fulkerson': 'Calcula la cantidad máxima de "flujo" (como agua, tráfico o datos) que puede viajar desde el Origen hasta el Destino respetando las capacidades máximas de cada arista.',
    'cpm': 'Calcula el tiempo mínimo necesario para terminar todo el proyecto. Identifica la <strong>Ruta Crítica</strong> (las actividades que si se retrasan, retrasan todo el proyecto).',
    'pert': 'Parecido al CPM, pero se utiliza cuando el tiempo de las actividades es incierto (usa tiempos optimistas, probables y pesimistas).'
};

function updateAlgoDescription() {
    const spec = document.getElementById('algo-specific').value;
    const descDiv = document.getElementById('algo-description');
    if (spec && algoDescriptions[spec]) {
        descDiv.style.display = 'block';
        descDiv.innerHTML = `<strong>¿Qué hace este algoritmo?</strong><br> ${algoDescriptions[spec]}`;
    } else {
        descDiv.style.display = 'none';
    }
}

function updateAlgoOptions() {
    const cat = document.getElementById('algo-category').value;
    const spec = document.getElementById('algo-specific');
    
    // Al cambiar la categoría, si estábamos mostrando un tooltip o descripción, lo reseteamos implícitamente
    spec.innerHTML = algoOptions[cat].map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    
    document.getElementById('algo-source-group').style.display = (cat === 'shortest' || cat === 'flow') ? 'block' : 'none';
    
    // Mostrar Destino para todos los algoritmos de ruta más corta (excepto Floyd-Warshall que es todos contra todos, si quieres, o para todos)
    // Para simplificar, Floyd-Warshall no lo usa en el backend de todos modos, pero Dijkstra y Bellman-Ford sí necesitan destino en nuestra UI actual.
    document.getElementById('algo-target-group').style.display = ((cat === 'shortest' && spec.value !== 'floyd-warshall') || cat === 'flow') ? 'block' : 'none';
    
    updateAlgoDescription();
}

// Override function to handle onchange from select elements in HTML
document.addEventListener('change', function(e) {
    if(e.target && e.target.id == 'algo-category') {
        updateAlgoOptions();
    } else if(e.target && e.target.id == 'algo-specific') {
        const cat = document.getElementById('algo-category').value;
        const spec = document.getElementById('algo-specific');
        document.getElementById('algo-target-group').style.display = ((cat === 'shortest' && spec.value !== 'floyd-warshall') || cat === 'flow') ? 'block' : 'none';
        updateAlgoDescription();
    }
});

// Initial setup
document.addEventListener('DOMContentLoaded', updateAlgoOptions);

function renderGraph() {
    const container = document.getElementById('network-graph');
    
    const colors = getThemeColors();
    const nodes = currentActivities.map(a => ({
        id: a.id,
        label: a.name,
        title: htmlTitle(getBaseTooltipHTML(a)),
        shape: 'box',
        margin: { top: 12, bottom: 12, left: 16, right: 16 },
        shapeProperties: { borderRadius: 8 },
        borderWidth: 2,
        color: { background: colors.bg, border: colors.border, highlight: { background: colors.hlBg, border: colors.hlBorder } },
        font: { color: colors.font, face: 'Plus Jakarta Sans', size: 14, strokeWidth: 3, strokeColor: colors.stroke }
    }));
    
    const edges = currentDependencies.map(d => ({
        id: d.id,
        from: d.from_activity_id,
        to: d.to_activity_id,
        label: `W:${d.weight} T:${d.time} C:${d.capacity}`,
        arrows: 'to',
        width: 1.5,
        color: { color: colors.edge, highlight: colors.border },
        font: { size: 11, face: 'Plus Jakarta Sans', align: 'horizontal', color: colors.font, strokeWidth: 3, strokeColor: colors.stroke }
    }));

    nodesDS = new vis.DataSet(nodes);
    edgesDS = new vis.DataSet(edges);

    const data = { nodes: nodesDS, edges: edgesDS };
    const options = {
        nodes: {
            shadow: {
                enabled: true,
                color: colors.shadow,
                size: 15,
                x: 0,
                y: 5
            }
        },
        edges: {
            smooth: {
                type: 'continuous',
                roundness: 0.5
            }
        },
        physics: { 
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -70,
                centralGravity: 0.005,
                springConstant: 0.04,
                springLength: 150,
                damping: 0.4,
                avoidOverlap: 0.8
            },
            stabilization: {
                enabled: true,
                iterations: 1000,
                updateInterval: 100,
                onlyDynamicEdges: false,
                fit: true
            }
        },
        interaction: { 
            hover: true,
            zoomView: false,
            tooltipDelay: 100
        }
    };

    if(network) network.destroy();
    network = new vis.Network(container, data, options);

    // WebSocket Integration: Broadcast when a node is moved
    network.on("dragEnd", function (params) {
        if (params.nodes && params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const position = network.getPositions([nodeId])[nodeId];
            if (typeof broadcastNodeMove === 'function') {
                broadcastNodeMove(nodeId, position.x, position.y);
            }
        }
    });

    // Animation Logic
    network.on("afterDrawing", function (ctx) {
        if (!animatedEdges || animatedEdges.length === 0) return;
        
        ctx.save();
        animatedEdges.forEach(edgeId => {
            const edgePositions = network.getPositions();
            const edgeData = edgesDS.get(edgeId);
            if (!edgeData) return;
            
            const fromNode = edgePositions[edgeData.from];
            const toNode = edgePositions[edgeData.to];
            
            if (fromNode && toNode) {
                // Calculate moving point
                const dx = toNode.x - fromNode.x;
                const dy = toNode.y - fromNode.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                
                // Offset moves from 0 to 1 repeatedly
                const x = fromNode.x + dx * animationOffset;
                const y = fromNode.y + dy * animationOffset;
                
                // Draw glow
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, 2 * Math.PI, false);
                ctx.fillStyle = currentGraphThemeLight ? '#4338CA' : '#60A5FA';
                ctx.shadowColor = currentGraphThemeLight ? '#4338CA' : '#60A5FA';
                ctx.shadowBlur = 15;
                ctx.fill();
                
                // Draw core
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI, false);
                ctx.fillStyle = '#FFFFFF';
                ctx.shadowBlur = 0;
                ctx.fill();
            }
        });
        ctx.restore();
    });

    if (animationReqId) cancelAnimationFrame(animationReqId);
    function animatePulse() {
        animationOffset += 0.015; // Speed of the pulse
        if (animationOffset > 1) animationOffset = 0;
        if (animatedEdges && animatedEdges.length > 0) {
            network.redraw(); // Trigger afterDrawing
        }
        animationReqId = requestAnimationFrame(animatePulse);
    }
    animatePulse();
}

function highlightGraph(pathNodes = [], pathEdges = [], cpmNodesInfo = null) {
    const colors = getThemeColors();
    animatedEdges = pathEdges; // Update animated edges

    // Reset
    nodesDS.forEach(n => {
        const a = currentActivities.find(act => act.id === n.id);
        let htmlContent = a ? getBaseTooltipHTML(a) : '';
        nodesDS.update({
            id: n.id, 
            color: { background: colors.bg, border: colors.border }, 
            font: {color: colors.font, strokeColor: colors.stroke}, 
            title: htmlTitle(htmlContent),
            borderWidth: 2,
            shadow: { color: colors.shadow, size: 15, x: 0, y: 5 }
        });
    });
    edgesDS.forEach(e => {
        edgesDS.update({
            id: e.id, 
            color: { color: colors.edge }, 
            width: 1.5,
            font: { color: colors.font, strokeColor: colors.stroke }
        });
    });

    // Highlight
    pathNodes.forEach(nId => {
        const a = currentActivities.find(act => act.id === nId);
        let htmlContent = a ? getBaseTooltipHTML(a) : '';
        if(cpmNodesInfo && cpmNodesInfo[nId]) {
            htmlContent += getCPMTooltipHTML(cpmNodesInfo[nId]);
        }
        nodesDS.update({
            id: nId, 
            color: { background: colors.redBg, border: colors.redBorder }, 
            font: {color: colors.redFont, strokeColor: colors.bg}, 
            title: htmlTitle(htmlContent),
            borderWidth: 3,
            shadow: { color: colors.redBorder, size: 20, x: 0, y: 0 }
        });
    });
    
    // Add CPM info to non-highlighted nodes too
    if (cpmNodesInfo) {
        nodesDS.forEach(n => {
            if (!pathNodes.includes(n.id) && cpmNodesInfo[n.id]) {
                const a = currentActivities.find(act => act.id === n.id);
                let htmlContent = a ? getBaseTooltipHTML(a) : '';
                htmlContent += getCPMTooltipHTML(cpmNodesInfo[n.id]);
                nodesDS.update({id: n.id, title: htmlTitle(htmlContent)});
            }
        });
    }

    pathEdges.forEach(eId => {
        edgesDS.update({
            id: eId, 
            color: { color: colors.redBorder }, 
            width: 4
        });
    });
}

async function runAlgorithm() {
    const cat = document.getElementById('algo-category').value;
    const algo = document.getElementById('algo-specific').value;
    const source = document.getElementById('algo-source').value;
    const target = document.getElementById('algo-target').value;
    const resPanel = document.getElementById('algo-results');
    
    resPanel.innerHTML = 'Calculando...';
    
    try {
        let res;
        if (cat === 'mst') {
            res = await api.runMST(currentProjectId, algo);
            highlightGraph([], res.edges);
            resPanel.innerHTML = `
                <div class="alert info">
                    <i class="ph-fill ph-info"></i>
                    <div>
                        <strong>Árbol de Expansión Mínima</strong><br>
                        Se han resaltado las conexiones óptimas que mantienen unida toda la red sin formar ciclos.
                    </div>
                </div>
                <div class="alert tip mt-2">
                    <i class="ph-fill ph-lightbulb"></i>
                    <div>
                        <strong>Consejo:</strong> Utiliza este resultado para diseñar redes (como cableado o tuberías) minimizando el costo total de los materiales.
                    </div>
                </div>
            `;
        } 
        else if (cat === 'shortest') {
            if(algo === 'floyd-warshall') {
                res = await api.runShortestPath(currentProjectId, algo, source);
                
                let tableHtml = `<div style="overflow-x: auto; margin-top: 10px; background: var(--card-bg); border-radius: var(--radius-sm); border: 1px solid var(--border);">
                    <table class="data-table" style="min-width: 100%; white-space: nowrap;">
                    <thead><tr><th style="background: var(--secondary-hover);">De \\ A</th>`;
                
                const nodeIds = Object.keys(res.distances);
                nodeIds.forEach(id => {
                    const act = currentActivities.find(a => a.id == id);
                    tableHtml += `<th style="background: var(--secondary-hover);">${act ? act.name : id}</th>`;
                });
                tableHtml += `</tr></thead><tbody>`;
                
                nodeIds.forEach(fromId => {
                    const fromAct = currentActivities.find(a => a.id == fromId);
                    tableHtml += `<tr><td style="background: var(--secondary-hover);"><strong>${fromAct ? fromAct.name : fromId}</strong></td>`;
                    nodeIds.forEach(toId => {
                        let val = res.distances[fromId][toId];
                        if (val === null || val === undefined) val = '∞';
                        tableHtml += `<td>${val}</td>`;
                    });
                    tableHtml += `</tr>`;
                });
                tableHtml += `</tbody></table></div>`;

                resPanel.innerHTML = `
                    <div class="alert info" style="flex-direction: column; align-items: stretch; gap: 0.5rem;">
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <i class="ph-fill ph-check-circle" style="font-size: 1.5rem;"></i>
                            <div><strong>Matriz de Distancias Mínimas (Floyd-Warshall)</strong></div>
                        </div>
                        ${tableHtml}
                    </div>
                `;
            } else {
                res = await api.runShortestPath(currentProjectId, algo, source, target || null);
                highlightGraph(res.path, res.edges);
                const pathNames = res.path.map(id => currentActivities.find(a => a.id === id)?.name || id).join(' ➔ ');
                resPanel.innerHTML = `
                    <div class="alert success">
                        <i class="ph-fill ph-check-circle"></i>
                        <div>
                            <strong>Ruta Más Corta:</strong><br>
                            Costo total: <strong>${res.distance}</strong><br>
                            Secuencia: ${pathNames}
                        </div>
                    </div>
                    <div class="alert tip mt-2">
                        <i class="ph-fill ph-lightbulb"></i>
                        <div>
                            <strong>Consejo:</strong> Esta es la vía más eficiente entre los nodos seleccionados. Útil para optimizar tiempos de entrega o costos de transporte.
                        </div>
                    </div>
                `;
            }
        }
        else if (cat === 'flow') {
            res = await api.runMaxFlow(currentProjectId, source, target);
            const edgeIds = res.flow_edges.map(e => e.edge_id);
            highlightGraph([], edgeIds);
            resPanel.innerHTML = `
                <div class="alert success">
                    <i class="ph-fill ph-waves"></i>
                    <div>
                        <strong>Flujo Máximo:</strong> ${res.max_flow} unidades
                    </div>
                </div>
                <div class="alert tip mt-2">
                    <i class="ph-fill ph-lightbulb"></i>
                    <div>
                        <strong>Consejo:</strong> Las aristas resaltadas indican las rutas utilizadas. El sistema ha distribuido el flujo respetando las capacidades máximas de cada conexión.
                    </div>
                </div>
            `;
        }
        else if (cat === 'pm') {
            res = await api.runCPM(currentProjectId); // PERT uses the same backend logic but can be extended
            highlightGraph(res.critical_path, res.critical_edges, res.nodes);
            const pathNames = res.critical_path.map(id => currentActivities.find(a => a.id === id)?.name || id).join(' ➔ ');
            resPanel.innerHTML = `
                <div class="alert warning">
                    <i class="ph-fill ph-warning-circle"></i>
                    <div>
                        <strong>Análisis (CPM / PERT):</strong><br>
                        Duración Mínima: <strong>${res.project_duration}</strong><br>
                        Ruta Crítica: ${pathNames}
                    </div>
                </div>
                <div class="alert tip mt-2">
                    <i class="ph-fill ph-lightbulb"></i>
                    <div>
                        <strong>Consejo Vital:</strong> Las actividades resaltadas en rojo forman la Ruta Crítica y tienen una holgura de 0. <strong>¡Cualquier retraso en ellas retrasará todo el proyecto!</strong> Vigílalas de cerca.
                    </div>
                </div>
                <div class="alert info mt-2">
                    <i class="ph-fill ph-calendar-blank"></i>
                    <div>
                        Ve a la pestaña "Línea de Tiempo (Gantt)" para ver esto reflejado en el calendario.
                    </div>
                </div>
            `;
        }
    } catch (e) {
        resPanel.innerHTML = `<span style="color:red">${e.message}</span>`;
    }
}

// Gantt Chart logic
let gantt = null;
let currentGanttTasks = [];
let simulationInterval = null;
let simCurrentDate = null;
let simMaxDate = null;
let simSpeed = 400;
let isSimPaused = false;

async function renderGantt() {
    if(currentActivities.length === 0) {
        document.getElementById('gantt-chart').innerHTML = 'No hay actividades.';
        return;
    }
    
    try {
        const cpmRes = await api.runCPM(currentProjectId);
        const tasks = currentActivities.map(a => {
            const nodeData = cpmRes.nodes[a.id];
            // Use real dates if provided
            let start = new Date();
            const dateInput = document.getElementById('gantt-start-date').value;
            if (dateInput) {
                start = new Date(dateInput);
                // Adjust for local timezone offset so it doesn't shift
                start.setMinutes(start.getMinutes() + start.getTimezoneOffset());
            }

            start.setDate(start.getDate() + nodeData.ES);
            
            let end = new Date(start);
            end.setDate(end.getDate() + (nodeData.EF - nodeData.ES));
            if (nodeData.ES === nodeData.EF) {
                end.setDate(end.getDate() + 1);
            }
            
            const isCritical = cpmRes.critical_path.includes(a.id);
            
            // Get dependencies to draw lines
            const deps = currentDependencies.filter(d => d.to_activity_id === a.id).map(d => 'Task_' + d.from_activity_id).join(',');

            return {
                id: 'Task_' + a.id,
                name: a.name,
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0],
                progress: 0,
                dependencies: deps,
                custom_class: isCritical ? 'bar-critical' : ''
            };
        });

        currentGanttTasks = tasks;

        document.getElementById('gantt-chart').innerHTML = '';
        gantt = new Gantt("#gantt-chart", currentGanttTasks, {
            view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
            view_mode: 'Day',
            language: 'es'
        });
        
        // Inject some CSS to highlight critical path bars
        const style = document.createElement('style');
        style.innerHTML = `
            .bar-critical .bar { fill: #ef4444 !important; }
            .bar-critical .bar-progress { fill: #b91c1c !important; }
        `;
        document.head.appendChild(style);

    } catch (e) {
        document.getElementById('gantt-chart').innerHTML = 'Error al generar Gantt. ' + e.message;
    }
}

function exportGraph() {
    const canvas = document.querySelector('#network-graph canvas');
    if (!canvas) return showToast('No se encontró el grafo', 'error');
    
    // Create a temporary canvas to draw the background since it's transparent
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    
    // Fill with background color
    const colors = getThemeColors();
    ctx.fillStyle = colors.exportBg;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the network canvas on top
    ctx.drawImage(canvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = 'grafo_proyecto.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

function updateSimulationMetrics() {
    const dateDisplay = document.getElementById('sim-date');
    const activeTasksDisplay = document.getElementById('sim-active-tasks');
    const costDisplay = document.getElementById('sim-cost');
    
    if (!dateDisplay) return;

    const formatDate = (date) => date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    dateDisplay.innerText = formatDate(simCurrentDate);

    let activeCount = 0;
    let accumulatedCost = 0;

    currentGanttTasks.forEach(t => {
        if (t.progress > 0) {
            if (t.progress < 100) activeCount++;
            
            // Calculate proportional cost
            const actId = parseInt(t.id.replace('Task_', ''));
            const activity = currentActivities.find(a => a.id === actId);
            if (activity && activity.cost) {
                accumulatedCost += activity.cost * (t.progress / 100);
            }
        }
    });

    activeTasksDisplay.innerText = activeCount.toString();
    costDisplay.innerText = accumulatedCost.toFixed(2);
}

function simulationTick() {
    if (isSimPaused) return;

    let isLastTick = false;
    if (simCurrentDate > simMaxDate) {
        isLastTick = true;
    }
    
    let changed = false;
    currentGanttTasks.forEach(t => {
        let s = new Date(t.start);
        let e = new Date(t.end);
        s.setHours(0,0,0,0);
        e.setHours(23,59,59,999);
        
        if (simCurrentDate >= e || isLastTick) {
            if (t.progress !== 100) {
                t.progress = 100;
                changed = true;
            }
        } else if (simCurrentDate >= s) {
            let totalDuration = e.getTime() - s.getTime();
            let elapsed = simCurrentDate.getTime() - s.getTime();
            let prog = Math.round((elapsed / totalDuration) * 100);
            if (t.progress !== prog) {
                t.progress = prog;
                changed = true;
            }
        }
    });
    
    if (changed) {
        gantt.refresh(currentGanttTasks);
        updateSimulationMetrics();
    }
    
    if (isLastTick) {
        stopSimulation(true);
        return;
    }
    
    // Advance 1 day
    simCurrentDate.setDate(simCurrentDate.getDate() + 1);
}

function startGanttSimulation() {
    if (!gantt || currentGanttTasks.length === 0) {
        if(typeof showToast === 'function') showToast('Genera el Gantt primero', 'warning');
        return;
    }
    
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    
    // reset progress
    currentGanttTasks.forEach(t => t.progress = 0);
    gantt.refresh(currentGanttTasks);
    
    let minDate = new Date(currentGanttTasks[0].start);
    let maxDate = new Date(currentGanttTasks[0].end);
    
    currentGanttTasks.forEach(t => {
        let s = new Date(t.start);
        let e = new Date(t.end);
        if (s < minDate) minDate = s;
        if (e > maxDate) maxDate = e;
    });
    
    simCurrentDate = new Date(minDate);
    simCurrentDate.setHours(0,0,0,0);
    simMaxDate = new Date(maxDate);
    simMaxDate.setHours(23,59,59,999);
    isSimPaused = false;
    
    if(typeof showToast === 'function') showToast('Simulación iniciada', 'success');

    // UI Updates
    const controls = document.getElementById('simulation-controls');
    const status = document.getElementById('sim-status');
    const btnPause = document.getElementById('btn-sim-pause');
    
    if (controls) controls.classList.add('active');
    if (status) {
        status.innerText = 'En Curso';
        status.className = 'badge';
        status.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
        status.style.color = '#34D399';
    }
    if (btnPause) {
        btnPause.innerHTML = '<i class="ph ph-pause"></i> Pausar';
        // En caso de que tuviera success, lo quitamos y ponemos primary
        btnPause.classList.remove('success');
        if(!btnPause.classList.contains('primary')) btnPause.classList.add('primary');
    }

    // Force reading speed from select
    const speedSelect = document.getElementById('sim-speed');
    if (speedSelect) simSpeed = parseInt(speedSelect.value) || 400;

    updateSimulationMetrics();
    simulationInterval = setInterval(simulationTick, simSpeed);
}

function toggleSimulationPause() {
    isSimPaused = !isSimPaused;
    const btnPause = document.getElementById('btn-sim-pause');
    const status = document.getElementById('sim-status');
    
    if (isSimPaused) {
        if (btnPause) {
            btnPause.innerHTML = '<i class="ph ph-play"></i> Reanudar';
            btnPause.classList.remove('primary');
            btnPause.classList.add('success');
        }
        if (status) {
            status.innerText = 'Pausado';
            status.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
            status.style.color = '#FBBF24';
        }
    } else {
        if (btnPause) {
            btnPause.innerHTML = '<i class="ph ph-pause"></i> Pausar';
            btnPause.classList.remove('success');
            btnPause.classList.add('primary');
        }
        if (status) {
            status.innerText = 'En Curso';
            status.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            status.style.color = '#34D399';
        }
    }
}

function stopSimulation(completed = false) {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    
    const controls = document.getElementById('simulation-controls');
    const status = document.getElementById('sim-status');
    
    if (completed) {
        if(typeof showToast === 'function') showToast('Simulación terminada', 'success');
        if (status) {
            status.innerText = 'Finalizado';
            status.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
            status.style.color = '#60A5FA';
        }
    } else {
        if(typeof showToast === 'function') showToast('Simulación detenida', 'info');
    }
    
    if (controls) {
        setTimeout(() => controls.classList.remove('active'), completed ? 3000 : 500);
    }
}

function changeSimulationSpeed() {
    const speedSelect = document.getElementById('sim-speed');
    if (!speedSelect) return;
    
    simSpeed = parseInt(speedSelect.value);
    
    if (simulationInterval && !isSimPaused) {
        clearInterval(simulationInterval);
        simulationInterval = setInterval(simulationTick, simSpeed);
    }
}

function detectCycle(fromId, toId) {
    const adj = {};
    currentActivities.forEach(a => adj[a.id] = []);
    currentDependencies.forEach(d => adj[d.from_activity_id].push(d.to_activity_id));
    
    adj[fromId].push(toId);
    
    const visited = {};
    const recStack = {};
    
    function dfs(node) {
        if (!visited[node]) {
            visited[node] = true;
            recStack[node] = true;
            for (const neighbor of adj[node] || []) {
                if (!visited[neighbor] && dfs(neighbor)) return true;
                else if (recStack[neighbor]) return true;
            }
        }
        recStack[node] = false;
        return false;
    }
    
    for (const a of currentActivities) {
        if (!visited[a.id]) {
            if (dfs(a.id)) return true;
        }
    }
    return false;
}



function exportGraph() {
    const canvas = document.querySelector('#network-graph canvas');
    if (!canvas) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    
    const colors = getThemeColors();
    ctx.fillStyle = colors.exportBg;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    ctx.drawImage(canvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = 'grafo_proyecto.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}
