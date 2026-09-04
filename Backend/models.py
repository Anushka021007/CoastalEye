from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Ship(Base):
    __tablename__ = "ships"

    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    last_lat = Column(Float)
    last_lon = Column(Float)
    last_seen = Column(DateTime)

    detections = relationship("Detection", back_populates="ship")


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    confidence = Column(Float)
    detected_at = Column(DateTime, default=datetime.datetime.utcnow)
    ship_id = Column(Integer, ForeignKey("ships.id"), nullable=True)

    ship = relationship("Ship", back_populates="detections")