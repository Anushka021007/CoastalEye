// CoastalEye API client

const API_BASE = "http://127.0.0.1:8000";

async function fetchJSON(path) {
    const response = await fetch(`${API_BASE}${path}`);

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
}

// Make functions globally available
window.getLiveMonitor = async function () {
    return fetchJSON("/live-monitor");
};

window.getDetections = async function () {
    return fetchJSON("/detections");
};

window.getDetection = async function (id) {
    return fetchJSON(`/detections/${id}`);
};

window.getReportUrl = function (id) {
    return `${API_BASE}/detections/${id}/report`;
};