import ee
import requests

ee.Initialize(project="sih-oilspill")

# Smaller Mumbai offshore area (about 15 km × 15 km)
MUMBAI = ee.Geometry.Rectangle([72.80, 18.95, 72.95, 19.10])

def fetch_latest_sentinel():
    image = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(MUMBAI)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .sort("system:time_start", False)
        .first()
    )

    url = image.getDownloadURL({
        "region": MUMBAI,
        "scale": 30,            # 30 m instead of 10 m
        "format": "GEO_TIFF",
        "bands": ["VV", "VH"]
    })

    print("Downloading Sentinel-1 image...")

    response = requests.get(url)
    response.raise_for_status()

    with open("latest_sentinel.tif", "wb") as f:
        f.write(response.content)

    print("✅ Saved latest_sentinel.tif")
    return "latest_sentinel.tif"

if __name__ == "__main__":
    fetch_latest_sentinel()