// CoastalEye API client
// Change this URL when backend is deployed

const API_BASE = 'http://localhost:8000';

async function fetchJSON(path) {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) {
        throw new Error(`API error ${response.status}`);
    }
    return response.json();
}

async function getDetections() {
    return fetchJSON('/detections');
}

async function getDetection(id) {
    return fetchJSON(`/detections/${id}`);
}

async function getShipTrack(mmsi, hours = 12) {
    return fetchJSON(`/ships/${mmsi}/track?hours=${hours}`);
}

function getReportUrl(detectionId) {
    return `${API_BASE}/detections/${detectionId}/report`;
}