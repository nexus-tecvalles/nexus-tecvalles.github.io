// WebSockets Logic para Colaboración en Tiempo Real

let ws = null;
let currentWsProjectId = null;
const clientId = Math.random().toString(36).substring(2, 15);

function connectWebSocket(projectId) {
    if (ws && currentWsProjectId === projectId) {
        return; // Ya está conectado a este proyecto
    }
    
    // Cerrar conexión anterior si existía
    if (ws) {
        ws.close();
    }

    currentWsProjectId = projectId;
    const wsUrl = `ws://${window.location.hostname}:8000/ws/${projectId}/${clientId}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log(`[WebSocket] Conectado al proyecto ${projectId}`);
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        // Ignorar mensajes enviados por nosotros mismos
        if (message.sender_id === clientId) return;

        console.log("[WebSocket] Mensaje recibido:", message);

        switch(message.type) {
            case 'NODE_MOVED':
                handleNodeMoved(message.data);
                break;
            case 'DATA_UPDATED':
                // Alguien creó/editó/borró actividad o dependencia, recargar datos de forma suave
                if (typeof loadProjectDetail === 'function') {
                    showToast('Un colaborador ha modificado los datos. Actualizando...', 'info');
                    // Recargar datos pero mantener la vista actual
                    loadProjectDetail(projectId);
                }
                break;
        }
    };

    ws.onclose = () => {
        console.log("[WebSocket] Desconectado");
        currentWsProjectId = null;
        // Podríamos intentar reconectar aquí si quisiéramos
    };
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
        currentWsProjectId = null;
    }
}

// Enviar un mensaje de que movimos un nodo
function broadcastNodeMove(nodeId, x, y) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'NODE_MOVED',
            data: { id: nodeId, x: x, y: y }
        }));
    }
}

// Enviar mensaje de que los datos cambiaron (para que otros refresquen)
function broadcastDataUpdate() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'DATA_UPDATED'
        }));
    }
}

// Manejar actualización visual del nodo sin recargar todo el grafo
function handleNodeMoved(data) {
    if (typeof nodes !== 'undefined' && nodes.get(data.id)) {
        // Actualizar la posición en el dataset de vis.js (el grafo se anima solo)
        // Vis.js `network.moveNode` es otra opción
        if (typeof network !== 'undefined') {
             network.moveNode(data.id, data.x, data.y);
             // También podemos guardarlo en el dataset local para no perderlo al redibujar
             nodes.update({ id: data.id, x: data.x, y: data.y });
        }
    }
}
