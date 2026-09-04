from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Oil spill detection API is running"}
from fastapi import FastAPI
from database import engine, Base
import models

# This creates the database tables based on models.py
Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Oil spill detection API is running"}
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Oil spill detection API is running"}

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