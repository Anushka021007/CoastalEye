from fastapi import FastAPI, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
import schemas

import os
import uuid

# Import our ML prediction function
from ml_predict import predict_oil_spill

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app ONLY ONCE
app = FastAPI(title="CoastalEye Oil Spill Detection API")

# Create folders for uploaded files and predictions
os.makedirs("uploads", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

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

@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    latitude: float = 0.0,
    longitude: float = 0.0,
    db: Session = Depends(get_db)
):
    filename = f"{uuid.uuid4()}.tif"
    upload_path = os.path.join("uploads", filename)

    with open(upload_path, "wb") as buffer:
        buffer.write(await file.read())

    mask_img, overlay_img, confidence, spill_area = predict_oil_spill(upload_path)

    mask_path = os.path.join("outputs", filename.replace(".tif", "_mask.png"))
    overlay_path = os.path.join("outputs", filename.replace(".tif", "_overlay.png"))

    mask_img.save(mask_path)
    overlay_img.save(overlay_path)

    detection = models.Detection(
        latitude=latitude,
        longitude=longitude,
        confidence=confidence
    )

    db.add(detection)
    db.commit()
    db.refresh(detection)

    return {
        "status": "success",
        "detection_id": detection.id,
        "confidence": round(confidence, 2),
        "spill_area_percent": spill_area,
        "mask_path": mask_path,
        "overlay_path": overlay_path
    }

