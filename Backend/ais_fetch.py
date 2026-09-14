import math
import random

# Mumbai offshore vessels
VESSELS = [
    {
        "ship_name": "MSC Elisa XIII",
        "mmsi": "636021546",
        "latitude": 19.0285,
        "longitude": 72.7712,
        "speed": 12.4,
        "heading": 274
    },
    {
        "ship_name": "MT Jag Pooja",
        "mmsi": "419987654",
        "latitude": 19.0415,
        "longitude": 72.7480,
        "speed": 8.7,
        "heading": 180
    },
    {
        "ship_name": "MV Ocean Success",
        "mmsi": "538234561",
        "latitude": 19.0152,
        "longitude": 72.7925,
        "speed": 5.1,
        "heading": 96
    },
    {
        "ship_name": "MT Chem Pioneer",
        "mmsi": "372445566",
        "latitude": 19.0608,
        "longitude": 72.7365,
        "speed": 10.3,
        "heading": 240
    },
    {
        "ship_name": "MV Maersk Athena",
        "mmsi": "563998877",
        "latitude": 18.9954,
        "longitude": 72.8124,
        "speed": 14.8,
        "heading": 312
    }
]


def haversine(lat1, lon1, lat2, lon2):
    R = 6371

    from math import radians, sin, cos, atan2, sqrt

    dlat = radians(lat2-lat1)
    dlon = radians(lon2-lon1)

    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return R * (2*atan2(sqrt(a), sqrt(1-a)))


def get_nearby_vessels(spill_lat=19.030, spill_lon=72.780):

    vessels = []

    for ship in VESSELS:

        distance = haversine(
            spill_lat,
            spill_lon,
            ship["latitude"],
            ship["longitude"]
        )

        vessel = ship.copy()

        vessel["latitude"] += random.uniform(-0.002, 0.002)
        vessel["longitude"] += random.uniform(-0.002, 0.002)

        vessel["distance_km"] = round(distance,2)

        vessels.append(vessel)

    vessels.sort(key=lambda x:x["distance_km"])

    return vessels