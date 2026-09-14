from gee_fetch import fetch_latest_sentinel
from fastapi import FastAPI, Depends 
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
import schemas
import threading
import time
from fastapi.staticfiles import StaticFiles
from ais_fetch import get_nearby_vessels

import os
import uuid

# Import our ML prediction function
from ml_predict import predict_oil_spill
from fastapi.middleware.cors import CORSMiddleware
# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app ONLY ONCE
app = FastAPI(title="CoastalEye Oil Spill Detection API")
latest_result = {
    "status": "Starting monitoring..."
}
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
# Create folders for uploaded files and predictions
os.makedirs("outputs", exist_ok=True)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Oil Spill Detection API is running"}

# INSERT a new ship
@app.post("/ships", response_model=schemas.ShipResponse)
def create_ship(ship: schemas.ShipCreate, db: Session = Depends(get_db)):
    new_ship = models.Ship(**ship.dict())
    db.add(new_ship)
    db.commit()
    db.refresh(new_ship)
    return new_ship

# SELECT all ships
@app.get("/ships", response_model=list[schemas.ShipResponse])
def get_ships(db: Session = Depends(get_db)):
    return db.query(models.Ship).all()
# INSERT a new detection
@app.post("/detections", response_model=schemas.DetectionResponse)
def create_detection(detection: schemas.DetectionCreate, db: Session = Depends(get_db)):
    new_detection = models.Detection(**detection.dict())
    db.add(new_detection)
    db.commit()
    db.refresh(new_detection)
    return new_detection

# SELECT all detections
@app.get("/detections", response_model=list[schemas.DetectionResponse])
def get_detections(db: Session = Depends(get_db)):
    return db.query(models.Detection).all()

@app.get("/live-monitor")
def live_monitor():
    return latest_result
#background live monitoring
# ==========================
# BACKGROUND LIVE MONITORING
# ==========================

import threading
import time

latest_result = {
    "status": "Starting monitoring..."
}

def monitor_loop():
    global latest_result

    while True:
        try:
            image_path = fetch_latest_sentinel()

            mask_img, overlay_img, confidence, spill_area, spill_polygon = predict_oil_spill(image_path)

            mask_img.save("outputs/latest_mask.png")
            overlay_img.save("outputs/latest_overlay.png")

            # Get nearby vessels
            vessels = get_nearby_vessels(
                spill_lat=19.030,
                spill_lon=72.780
            )
            # Calculate risk score
            for vessel in vessels:
                score = 100

                distance = vessel["distance_km"]
                score -= distance * 8

                if vessel["speed"] > 10:
                    score += 10

                vessel["risk_score"] = max(10, min(100, int(score)))
            # Final API response
            latest_result = {
                "status": "Monitoring Mumbai Coast",
                "oil_spill_detected": confidence >= 60,
                "confidence": round(confidence, 2),
                "spill_area_percent": round(spill_area, 2),

                "location": {
                    "latitude": 19.0760,
                    "longitude": 72.8777
                },

                "geometry": {
                    "type": "Polygon",
                    "coordinates": spill_polygon
                },

                "vessels": vessels,

                "acquisition_time": time.strftime("%Y-%m-%d %H:%M:%S")
           }

            print("✅ Coastline checked")
        except Exception as e:
            print("Monitoring Error:", e)

        time.sleep(300)


@app.on_event("startup")
def start_monitor():
    threading.Thread(target=monitor_loop, daemon=True).start()