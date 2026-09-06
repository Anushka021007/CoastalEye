// Detection detail page - map, ships, time slider

let map = null;
let spillLayer = null;
let shipMarkers = [];
let trackLines = [];
let detection = null;
let shipTracks = [];

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const detectionId = params.get('id');

    if (!detectionId) {
        alert('No detection ID provided');
        return;
    }

    try {
        detection = await getDetection(detectionId);
    } catch (err) {
        console.warn('Using mock data:', err);
        detection = getMockDetection();
    }

    initMap();
    renderDetection();
    renderSuspects();
    setupTimeSlider();
    setupReportButton();

    document.getElementById('loading').classList.add('d-none');
    document.getElementById('content').classList.remove('d-none');
});

function initMap() {
    // Center map on spill location
    const coords = detection.geometry.coordinates[0];
    const centerLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    const centerLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;

    map = L.map('map').setView([centerLat, centerLon], 11);

    // Dark base map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19
    }).addTo(map);

    // Add spill polygon
    const spillCoords = detection.geometry.coordinates[0].map(c => [c[1], c[0]]);
    spillLayer = L.polygon(spillCoords, {
        color: '#d85a30',
        fillColor: '#d85a30',
        fillOpacity: 0.5,
        weight: 2
    }).addTo(map);

    // Render ship tracks and markers (mock or real)
    renderShips();
}

function renderShips() {
    const suspects = detection.suspects || [];
    const topSuspectMmsi = suspects[0]?.mmsi;

    suspects.forEach(suspect => {
        const track = generateMockTrack(suspect.mmsi, suspect === suspects[0]);
        shipTracks.push({ mmsi: suspect.mmsi, pings: track, isTopSuspect: suspect.mmsi === topSuspectMmsi });
        
        // Add track line
        const line = L.polyline(track.map(p => [p.lat, p.lon]), {
            color: suspect.mmsi === topSuspectMmsi ? '#e24b4a' : '#85b7eb',
            weight: suspect.mmsi === topSuspectMmsi ? 3 : 2,
            opacity: 0.7
        }).addTo(map);
        trackLines.push(line);

        // Add ship marker at current position (last ping)
        const lastPing = track[track.length - 1];
        const marker = L.circleMarker([lastPing.lat, lastPing.lon], {
            radius: suspect.mmsi === topSuspectMmsi ? 10 : 6,
            fillColor: suspect.mmsi === topSuspectMmsi ? '#e24b4a' : '#85b7eb',
            color: '#fff',
            weight: 2,
            fillOpacity: 1
        }).bindPopup(`<b>${suspect.ship_name || 'Unknown'}</b><br>MMSI: ${suspect.mmsi}`);
        marker.addTo(map);
        shipMarkers.push({ marker, track, mmsi: suspect.mmsi });
    });
}

function updateShipPositions(timePercent) {
    // Update each ship's position based on slider
    shipMarkers.forEach(({ marker, track }) => {
        const index = Math.floor(timePercent * (track.length - 1));
        const ping = track[index];
        marker.setLatLng([ping.lat, ping.lon]);
    });

    // Trail lines: show only up to current time
    trackLines.forEach((line, i) => {
        const track = shipTracks[i].pings;
        const index = Math.floor(timePercent * (track.length - 1));
        const visibleCoords = track.slice(0, index + 1).map(p => [p.lat, p.lon]);
        line.setLatLngs(visibleCoords);
    });
}

function setupTimeSlider() {
    const slider = document.getElementById('time-slider');
    const label = document.getElementById('time-label');

    slider.addEventListener('input', (e) => {
        const percent = e.target.value / 100;
        const hoursBefore = ((1 - percent) * 6).toFixed(1);
        label.textContent = percent === 1 ? 'Detection time' : `-${hoursBefore}h`;
        updateShipPositions(percent);
    });
}

function renderDetection() {
    document.getElementById('detection-title').textContent = `Detection #${detection.id}`;
    document.getElementById('detection-time').innerHTML = `
        <i class="bi bi-clock"></i> ${new Date(detection.detected_at).toLocaleString('en-IN')}
    `;
    document.getElementById('stat-area').textContent = `${detection.area_km2?.toFixed(1) || '?'} km²`;
    document.getElementById('stat-confidence').textContent = detection.confidence 
        ? `${(detection.confidence * 100).toFixed(0)}%` : '?';
    document.getElementById('stat-wind').textContent = detection.wind_speed_ms 
        ? `${detection.wind_speed_ms.toFixed(1)} m/s` : '?';
    document.getElementById('stat-suspects').textContent = detection.suspects?.length || 0;
}

function renderSuspects() {
    const container = document.getElementById('suspects-list');
    const suspects = detection.suspects || [];

    container.innerHTML = suspects.map((s, i) => `
        <div class="d-flex gap-2 p-2 mb-2 border rounded suspect-card ${i === 0 ? 'top-suspect' : ''}"
             style="cursor: pointer;" onclick="showEvidence(${i})">
            <div class="suspect-rank ${i === 0 ? 'top-suspect' : ''}">${i + 1}</div>
            <div class="flex-grow-1">
                <div class="fw-bold ${i === 0 ? 'text-danger' : ''}">
                    <i class="bi bi-ship"></i> ${s.ship_name || 'Unknown Vessel'}
                </div>
                <small class="text-muted">${s.ship_flag || 'Unknown'} · ${s.ship_type || 'Unknown'}</small>
                ${s.dark_ship_flag ? '<div><span class="badge bg-danger mt-1"><i class="bi bi-exclamation-triangle"></i> Dark ship event</span></div>' : ''}
            </div>
            <div class="text-end">
                <div class="score fs-4">${s.score?.toFixed(0) || '?'}</div>
                <small class="text-muted">score</small>
            </div>
        </div>
    `).join('');
}

function showEvidence(index) {
    const suspect = detection.suspects[index];
    const body = document.getElementById('evidence-body');
    body.innerHTML = `
        <h5>${suspect.ship_name || 'Unknown Vessel'}</h5>
        <p><strong>MMSI:</strong> ${suspect.mmsi}<br>
        <strong>Flag:</strong> ${suspect.ship_flag}<br>
        <strong>Type:</strong> ${suspect.ship_type}</p>
        <hr>
        <h6>Score Breakdown</h6>
        <ul>
            <li>Proximity to spill: <strong>${suspect.scores_breakdown?.proximity || 0}/40</strong></li>
            <li>Trajectory crossing: <strong>${suspect.scores_breakdown?.trajectory || 0}/30</strong></li>
            <li>Dark ship signature: <strong>${suspect.scores_breakdown?.dark_ship || 0}/20</strong></li>
            <li>Speed anomaly: <strong>${suspect.scores_breakdown?.speed_anomaly || 0}/10</strong></li>
        </ul>
        ${suspect.evidence?.dark_ship_flag ? `
            <div class="alert alert-danger">
                <strong>Dark Ship Event:</strong> AIS transponder was offline for 
                ${suspect.evidence.max_ais_gap_minutes} minutes during spill formation.
            </div>
        ` : ''}
    `;
    new bootstrap.Modal(document.getElementById('evidenceModal')).show();
}

function setupReportButton() {
    document.getElementById('download-report-btn').onclick = () => {
        window.open(getReportUrl(detection.id), '_blank');
    };
}

// ===== MOCK DATA (used when backend not ready) =====
function getMockDetection() {
    return {
        id: 1,
        scene_name: 'mumbai_20240112',
        detected_at: '2024-01-12T03:42:00Z',
        area_km2: 4.7,
        confidence: 0.89,
        wind_speed_ms: 4.2,
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [72.83, 19.00], [72.87, 19.00], [72.87, 19.04],
                [72.83, 19.04], [72.83, 19.00]
            ]]
        },
        suspects: [
            { mmsi: 371234567, ship_name: 'MV Aurora Star', ship_flag: 'Panama', ship_type: 'Tanker',
              score: 92, dark_ship_flag: true,
              scores_breakdown: { proximity: 40, trajectory: 30, dark_ship: 15, speed_anomaly: 7 },
              evidence: { dark_ship_flag: true, max_ais_gap_minutes: 47 } },
            { mmsi: 235445566, ship_name: 'Sea Horizon', ship_flag: 'Liberia', ship_type: 'Cargo',
              score: 34, dark_ship_flag: false,
              scores_breakdown: { proximity: 20, trajectory: 0, dark_ship: 0, speed_anomaly: 14 } },
            { mmsi: 477334455, ship_name: 'Coastal Pride', ship_flag: 'India', ship_type: 'Fishing',
              score: 12, dark_ship_flag: false,
              scores_breakdown: { proximity: 10, trajectory: 0, dark_ship: 0, speed_anomaly: 2 } }
        ]
    };
}

function generateMockTrack(mmsi, isSuspect) {
    const track = [];
    const startTime = Date.now() - 6 * 3600 * 1000;
    const spillLat = 19.02, spillLon = 72.85;

    for (let i = 0; i < 30; i++) {
        const t = i / 29;
        let lat, lon;
        if (isSuspect) {
            lat = 19.02 + (0.15 - t * 0.3) + (Math.random() - 0.5) * 0.005;
            lon = 72.85 + (-0.15 + t * 0.3) + (Math.random() - 0.5) * 0.005;
        } else {
            lat = 19.15 + t * 0.05 + (Math.random() - 0.5) * 0.005;
            lon = 72.70 + t * 0.15 + (Math.random() - 0.5) * 0.005;
        }
        track.push({ lat, lon, timestamp: new Date(startTime + i * 480000).toISOString() });
    }
    return track;
}