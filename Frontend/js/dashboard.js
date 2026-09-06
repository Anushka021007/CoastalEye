// Dashboard logic - loads and displays list of detections

document.addEventListener('DOMContentLoaded', async () => {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const grid = document.getElementById('detections-grid');

    try {
        const detections = await getDetections();
        loading.classList.add('d-none');
        grid.classList.remove('d-none');
        renderDetections(detections);
    } catch (err) {
        loading.classList.add('d-none');
        error.classList.remove('d-none');
        document.getElementById('error-message').textContent = err.message;
        
        // MOCK DATA for development while backend isn't ready
        console.warn('Using mock data since API failed');
        renderDetections(getMockDetections());
        grid.classList.remove('d-none');
        error.classList.add('d-none');
    }
});

function renderDetections(detections) {
    const grid = document.getElementById('detections-grid');
    grid.innerHTML = detections.map(d => `
        <div class="col-md-6 col-lg-4">
            <a href="detection.html?id=${d.id}" class="text-decoration-none text-dark">
                <div class="card h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <small class="text-muted">
                                    <i class="bi bi-geo-alt"></i> ${d.location_name || 'Unknown'}
                                </small>
                                <h5 class="card-title mb-0">Detection #${d.id}</h5>
                            </div>
                            ${d.confidence > 0.8 ? '<span class="badge bg-danger">High Confidence</span>' : ''}
                        </div>
                        <p class="text-muted small mb-3">
                            <i class="bi bi-clock"></i> ${formatDate(d.detected_at)}
                        </p>
                        <div class="row text-center border-top pt-3">
                            <div class="col-4">
                                <small class="text-muted d-block">Area</small>
                                <strong>${d.area_km2?.toFixed(1) || '?'} km²</strong>
                            </div>
                            <div class="col-4">
                                <small class="text-muted d-block">Confidence</small>
                                <strong>${d.confidence ? (d.confidence * 100).toFixed(0) + '%' : '?'}</strong>
                            </div>
                            <div class="col-4">
                                <small class="text-muted d-block">Suspects</small>
                                <strong><i class="bi bi-ship"></i> ${d.suspect_count || 0}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </a>
        </div>
    `).join('');
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', { 
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Mock data for development (before backend is ready)
function getMockDetections() {
    return [
        { id: 1, location_name: 'Mumbai coast', detected_at: '2024-01-12T03:42:00Z', area_km2: 4.7, confidence: 0.89, suspect_count: 3 },
        { id: 2, location_name: 'Ennore port', detected_at: '2023-08-24T14:20:00Z', area_km2: 2.1, confidence: 0.76, suspect_count: 2 },
        { id: 3, location_name: 'Gulf of Kutch', detected_at: '2024-03-08T09:15:00Z', area_km2: 11.3, confidence: 0.94, suspect_count: 3 }
    ];
}