-- CoastalEye Database Schema
-- Creates all tables and indexes for oil spill detection and vessel attribution

-- Enable PostGIS (already done, but safe to run again)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table 1: Satellite scenes we've analyzed
CREATE TABLE IF NOT EXISTS scenes (
    id SERIAL PRIMARY KEY,
    scene_name VARCHAR(255) UNIQUE NOT NULL,
    acquired_at TIMESTAMP WITH TIME ZONE NOT NULL,
    bbox GEOMETRY(POLYGON, 4326) NOT NULL,
    satellite VARCHAR(50) DEFAULT 'Sentinel-1',
    file_path TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scenes_bbox_idx ON scenes USING GIST(bbox);
CREATE INDEX IF NOT EXISTS scenes_time_idx ON scenes(acquired_at);

-- Table 2: Detected oil spills
CREATE TABLE IF NOT EXISTS detections (
    id SERIAL PRIMARY KEY,
    scene_id INTEGER REFERENCES scenes(id),
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    area_km2 FLOAT,
    confidence FLOAT,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    wind_speed_ms FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS detections_geom_idx ON detections USING GIST(geometry);
CREATE INDEX IF NOT EXISTS detections_time_idx ON detections(detected_at);

-- Table 3: Ship metadata
CREATE TABLE IF NOT EXISTS ships (
    mmsi BIGINT PRIMARY KEY,
    name VARCHAR(255),
    flag VARCHAR(100),
    vessel_type VARCHAR(100),
    length_m FLOAT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table 4: AIS ship location pings (the main data)
CREATE TABLE IF NOT EXISTS ship_pings (
    id BIGSERIAL PRIMARY KEY,
    mmsi BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    geometry GEOMETRY(POINT, 4326) NOT NULL,
    speed_knots FLOAT,
    course_degrees FLOAT
);
CREATE INDEX IF NOT EXISTS pings_geom_idx ON ship_pings USING GIST(geometry);
CREATE INDEX IF NOT EXISTS pings_time_idx ON ship_pings(timestamp);
CREATE INDEX IF NOT EXISTS pings_mmsi_idx ON ship_pings(mmsi);

-- Table 5: Suspect ships for each detection
CREATE TABLE IF NOT EXISTS suspects (
    id SERIAL PRIMARY KEY,
    detection_id INTEGER REFERENCES detections(id),
    mmsi BIGINT REFERENCES ships(mmsi),
    score FLOAT NOT NULL,
    proximity_score FLOAT,
    trajectory_score FLOAT,
    dark_ship_score FLOAT,
    speed_anomaly_score FLOAT,
    dark_ship_flag BOOLEAN DEFAULT FALSE,
    evidence JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suspects_detection_idx ON suspects(detection_id);