let map = null;
let spillLayer = null;
let refreshTimer = null;

let secondsRemaining = 30;


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
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
            maxZoom: 19,
            attribution: "© OpenStreetMap © CARTO"
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
        data.detected ??
        (data.confidence > 0.5);


    const detectionValue =
        document.getElementById("detection-value");


    const detectionState =
        document.getElementById("detection-state");


    if (detected) {

        detectionValue.textContent =
            "SIGNATURE DETECTED";

        detectionValue.classList.add("alert");

        detectionState.textContent =
            "ATTENTION";

    } else {

        detectionValue.textContent =
            "NO SIGNATURE";

        detectionValue.classList.remove("alert");

        detectionState.textContent =
            "CLEAR";

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

    if (data.latitude) {

        document.getElementById(
            "latitude"
        ).textContent =
            Number(data.latitude)
                .toFixed(4);

    }


    if (data.longitude) {

        document.getElementById(
            "longitude"
        ).textContent =
            Number(data.longitude)
                .toFixed(4);

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

    renderVessels(
        data.vessels || []
    );

}


/* ================================
   SPILL OVERLAY
================================ */

function drawSpill(geometry) {

    if (spillLayer) {

        map.removeLayer(spillLayer);

    }


    const coords =
        geometry.coordinates[0]
            .map(point => [
                point[1],
                point[0]
            ]);


    spillLayer =
        L.polygon(
            coords,
            {
                color: "#e88e8e",
                weight: 2,
                opacity: 0.9,
                fillColor: "#e88e8e",
                fillOpacity: 0.22
            }
        ).addTo(map);


    map.fitBounds(
        spillLayer.getBounds(),
        {
            padding: [60, 60]
        }
    );

}


/* ================================
   VESSELS
================================ */

function renderVessels(vessels) {

    const container =
        document.getElementById(
            "vessel-list"
        );


    document.getElementById(
        "vessel-count"
    ).textContent =
        `${vessels.length} TRACKS`;


    if (!vessels.length) {

        container.innerHTML = `
            <div class="empty-state">
                No correlated vessels in current scene.
            </div>
        `;

        return;
    }


    container.innerHTML =
        vessels.map(
            (vessel, index) => `

            <div class="vessel-row">

                <div class="vessel-rank">
                    ${String(index + 1).padStart(2, "0")}
                </div>

                <div class="vessel-main">

                    <strong>
                        ${vessel.ship_name ||
                        "UNKNOWN VESSEL"}
                    </strong>

                    <span>
                        MMSI ${vessel.mmsi || "—"}
                    </span>

                </div>

                <div class="vessel-score">

                    ${vessel.score || "—"}

                </div>

            </div>

        `
        ).join("");

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