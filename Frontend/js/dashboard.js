let map = null;
let spillLayer = null;
let refreshTimer = null;
let overlayTimer = null;

let secondsRemaining = 30;
let vesselMarkers = [];

/* ================================
   INITIALIZE
================================ */

document.addEventListener("DOMContentLoaded", () => {

    initializeMap();

    loadLiveData();

    startAutoRefresh();

});


/* ================================
   MAP
================================ */

function initializeMap() {

    map = L.map("map", {
        zoomControl: false,
        attributionControl: true
    }).setView([19.02, 72.85], 10);


    L.control.zoom({
        position: "bottomright"
    }).addTo(map);


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "© OpenStreetMap contributors © CARTO"
        }
    ).addTo(map);


    // Initial monitoring area

    L.rectangle(
        [
            [18.95, 72.80],
            [19.10, 72.95]
        ],
        {
            color: "#6fb8d5",
            weight: 1,
            opacity: 0.25,
            fill: false,
            dashArray: "4 6"
        }
    ).addTo(map);


    // Mumbai monitoring point

    L.circleMarker(
        [19.02, 72.85],
        {
            radius: 5,
            color: "#a8dadc",
            fillColor: "#a8dadc",
            fillOpacity: 1,
            weight: 1
        }
    )
    .bindTooltip("MONITORING REGION", {
        permanent: false
    })
    .addTo(map);

}


/* ================================
   LIVE DATA
================================ */

async function loadLiveData() {

    setSystemStatus("ACQUIRING");


    try {

        const data = await getLiveMonitor();

        console.log("LIVE MONITOR:", data);


        updateDashboard(data);


        setSystemStatus("SYSTEM ONLINE");


    } catch (error) {

        console.error(error);

        setSystemStatus("GEE CONNECTION ERROR");


        /*
         * Temporary development fallback.
         *
         * Remove this once /live-monitor
         * is completely working.
         */

        updateDashboard({

            status: "LIVE",

            confidence: 0.89,

            spill_area_percent: 3.7,

            latitude: 19.02,

            longitude: 72.85,

            detected: true,

            acquisition_time: new Date().toISOString(),

            vessels: []

        });

    }

}


/* ================================
   UPDATE DASHBOARD
================================ */

function updateDashboard(data) {


    /* STATUS */

    const detected =
        data.oil_spill_detected ??
        (data.confidence > 0.6);


    const detectionValue =
        document.getElementById("detection-value");


    const detectionState =
        document.getElementById("detection-state");


    if (detected) {

        detectionValue.textContent = "OIL SPILL DETECTED";
        detectionValue.classList.add("alert");

        detectionState.textContent = "HIGH RISK";
        detectionState.style.color = "#ff4d4d";

    } else {

        detectionValue.textContent = "NO OIL SPILL";
        detectionValue.classList.remove("alert");

        detectionState.textContent = "SAFE";
        detectionState.style.color = "#6fb8d5";
    }


    /* CONFIDENCE */

    const confidence =
        Number(data.confidence || 0);


    const confidencePercent =
        Math.round(
            confidence <= 1
                ? confidence * 100
                : confidence
        );


    document.getElementById(
        "confidence"
    ).textContent =
        `${confidencePercent}%`;


    document.getElementById(
        "confidence-fill"
    ).style.width =
        `${confidencePercent}%`;


    /* AREA */

    const area =
        Number(
            data.spill_area_percent || 0
        );


    document.getElementById(
        "spill-area"
    ).textContent =
        `${area.toFixed(2)}%`;


    /* COORDINATES */

    const lat = data.location?.latitude;
    const lon = data.location?.longitude;

    if (lat !== undefined) {
        document.getElementById("latitude").textContent =
            Number(lat).toFixed(4);
    }

    if (lon !== undefined) {
        document.getElementById("longitude").textContent =
            Number(lon).toFixed(4);
    }
    

    /* ACQUISITION */

    const acquisition =
        data.acquisition_time ||
        data.detected_at ||
        new Date().toISOString();


    document.getElementById(
        "acquisition-time"
    ).textContent =
        formatTime(acquisition);


    /* SPILL */

    if (
        data.geometry &&
        data.geometry.coordinates
    ) {

        drawSpill(data.geometry);

    }


    /* VESSELS */

    renderVessels(data.vessels || []);
    drawVessels(data.vessels || []);
    /* LIVE SATELLITE IMAGE */

    const overlay = document.getElementById("satellite-overlay");

    if (overlay) {
        overlay.src =
            "http://127.0.0.1:8000/outputs/latest_overlay.png?" +
            Date.now();
    }

}


/* ================================
   SPILL OVERLAY
================================ */

function drawSpill(geometry) {

    if (!geometry || !geometry.coordinates || geometry.coordinates.length === 0) {
        return;
    }

    // Remove previous spill polygon
    if (spillLayer) {
        map.removeLayer(spillLayer);
    }

    // Convert GeoJSON [lon, lat] -> Leaflet [lat, lon]
    const coords = geometry.coordinates[0].map(([lon, lat]) => [lat, lon]);

    spillLayer = L.polygon(coords, {
        color: "#ff3b3b",
        fillColor: "#ff3b3b",
        fillOpacity: 0.35,
        weight: 2
    }).addTo(map);

    // Zoom map to detected spill
    map.fitBounds(spillLayer.getBounds(), {
        padding: [30, 30]
    });
}
function drawVessels(vessels) {

    vesselMarkers.forEach(marker => map.removeLayer(marker));
    vesselMarkers = [];

    vessels.forEach(vessel => {

        const marker = L.circleMarker(
            [vessel.latitude, vessel.longitude],
            {
                radius: 7,
                color: "#3b82f6",
                fillColor: "#60a5fa",
                fillOpacity: 0.9,
                weight: 2
            }
        ).addTo(map);

        marker.bindPopup(`
            <strong>${vessel.ship_name}</strong><br>
            MMSI: ${vessel.mmsi}<br>
            Risk Score: ${vessel.risk_score}<br>
            Distance: ${vessel.distance_km} km
        `);

        vesselMarkers.push(marker);
        L.polyline(
            [
                [19.0760, 72.8777],          // spill location
                [vessel.latitude, vessel.longitude]
            ],
            {
                color: "#00d4ff",
                weight: 2,
                dashArray: "6 6",
                opacity: 0.8
            }
        ).addTo(map);
    });
}

/* ================================
   VESSELS
================================ */

function renderVessels(vessels) {

    const container = document.getElementById("vessel-list");

    document.getElementById("vessel-count").textContent =
        `${vessels.length} TRACKS`;

    if (vessels.length === 0) {
        container.innerHTML =
            `<div class="empty-state">Awaiting AIS correlation...</div>`;
        return;
    }

    container.innerHTML = vessels.map((vessel, index) => `
        <div class="vessel-row">

            <div class="vessel-rank">${index + 1}</div>

            <div class="vessel-main">
                <strong>${vessel.ship_name}</strong><br>
                MMSI ${vessel.mmsi}
            </div>

            <div class="vessel-score">
                ${vessel.risk_score}
            </div>

        </div>
    `).join("");
}

/* ================================
   AUTO REFRESH
================================ */

function startAutoRefresh() {

    refreshTimer =
        setInterval(() => {

            secondsRemaining--;

            document.getElementById(
                "refresh-countdown"
            ).textContent =
                `${secondsRemaining}s`;


            if (secondsRemaining <= 0) {

                secondsRemaining = 30;

                loadLiveData();

            }

        }, 1000);

}


/* ================================
   STATUS
================================ */

function setSystemStatus(status) {

    document.getElementById(
        "system-status"
    ).textContent =
        status;

}


/* ================================
   TIME
================================ */

function formatTime(value) {

    try {

        return new Date(value)
            .toLocaleString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC"
                }
            );

    } catch {

        return "—";

    }

}
