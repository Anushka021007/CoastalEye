from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ShipCreate(BaseModel):
    mmsi: str
    name: Optional[str] = None
    last_lat: float
    last_lon: float
    last_seen: datetime

class ShipResponse(BaseModel):
    id: int
    mmsi: str
    name: Optional[str] = None
    last_lat: float
    last_lon: float
    last_seen: datetime

    class Config:
        from_attributes = True
class DetectionCreate(BaseModel):
    latitude: float
    longitude: float
    confidence: float

class DetectionResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    confidence: float
    detected_at: datetime
    ship_id: Optional[int] = None

    class Config:
        from_attributes = True        