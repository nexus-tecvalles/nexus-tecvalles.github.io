const API_URL = `https://nexus-backend-n0pq.onrender.com`;

const api = {
    // Projects
    getProjects: () => fetch(`${API_URL}/projects/`).then(res => res.json()),
    createProject: (data) => fetch(`${API_URL}/projects/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => res.json()),
    updateProject: (id, data) => fetch(`${API_URL}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => res.json()),
    deleteProject: (id) => fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' }).then(res => res.json()),

    // Activities
    getActivities: (projectId) => fetch(`${API_URL}/projects/${projectId}/activities/`).then(res => res.json()),
    createActivity: (projectId, data) => fetch(`${API_URL}/projects/${projectId}/activities/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => res.json()),
    updateActivity: (activityId, data) => fetch(`${API_URL}/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => res.json()),
    deleteActivity: (id) => fetch(`${API_URL}/activities/${id}`, { method: 'DELETE' }).then(res => res.json()),

    // Dependencies
    getDependencies: (projectId) => fetch(`${API_URL}/projects/${projectId}/dependencies/`).then(res => res.json()),
    createDependency: (projectId, data) => fetch(`${API_URL}/projects/${projectId}/dependencies/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => res.json()),
    updateDependency: (dependencyId, data) => fetch(`${API_URL}/dependencies/${dependencyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => res.json()),
    deleteDependency: (id) => fetch(`${API_URL}/dependencies/${id}`, { method: 'DELETE' }).then(res => res.json()),

    // Algorithms
    runShortestPath: (projectId, algo, source, target) => {
        let url = `${API_URL}/projects/${projectId}/algorithms/shortest-path?algo=${algo}&source=${source}`;
        if(target) url += `&target=${target}`;
        return fetch(url).then(res => {
            if(!res.ok) throw new Error("Error en algoritmo");
            return res.json();
        });
    },
    runMST: (projectId, algo) => fetch(`${API_URL}/projects/${projectId}/algorithms/mst?algo=${algo}`).then(res => res.json()),
    runMaxFlow: (projectId, source, target) => fetch(`${API_URL}/projects/${projectId}/algorithms/max-flow?source=${source}&target=${target}`).then(res => res.json()),
    runCPM: (projectId) => fetch(`${API_URL}/projects/${projectId}/algorithms/cpm`).then(res => {
        if(!res.ok) throw new Error("Posible ciclo detectado, no se puede calcular CPM");
        return res.json();
    }),
    runPERT: (projectId) => fetch(`${API_URL}/projects/${projectId}/algorithms/pert`).then(res => res.json())
};
