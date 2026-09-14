
import numpy as np
import cv2
import tifffile
import torch
import torch.nn as nn
from torchvision.transforms import Resize
from PIL import Image

# ---------------- U-Net ---------------- #

class DoubleConv(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()

        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, 3, padding=1),
            nn.ReLU(inplace=True)
        )

    def forward(self, x):
        return self.conv(x)

class UNet(nn.Module):
    def __init__(self):
        super().__init__()

        self.down1 = DoubleConv(2,32)
        self.pool1 = nn.MaxPool2d(2)

        self.down2 = DoubleConv(32,64)
        self.pool2 = nn.MaxPool2d(2)

        self.bridge = DoubleConv(64,128)

        self.up1 = nn.ConvTranspose2d(128,64,2,stride=2)
        self.conv1 = DoubleConv(128,64)

        self.up2 = nn.ConvTranspose2d(64,32,2,stride=2)
        self.conv2 = DoubleConv(64,32)

        self.final = nn.Conv2d(32,1,1)

    def forward(self,x):

        c1 = self.down1(x)
        p1 = self.pool1(c1)

        c2 = self.down2(p1)
        p2 = self.pool2(c2)

        b = self.bridge(p2)

        u1 = self.up1(b)
        u1 = torch.cat([u1,c2],dim=1)
        u1 = self.conv1(u1)

        u2 = self.up2(u1)
        u2 = torch.cat([u2,c1],dim=1)
        u2 = self.conv2(u2)

        return self.final(u2)

# ------------- Load model once ------------- #

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = UNet().to(device)

model.load_state_dict(
    torch.load("oil_spill_unet.pth", map_location=device)
)

model.eval()

def mask_to_geojson(mask_array):
    """
    Convert binary spill mask into GeoJSON coordinates.
    """

    mask = (mask_array > 127).astype(np.uint8)

    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    geojson_polygons = []

    for contour in contours:

        if cv2.contourArea(contour) < 80:
            continue

        coords = []

        for point in contour.squeeze():

            x, y = point

            # Convert pixel → Mumbai lat/lon
            lon = 72.80 + (x / mask.shape[1]) * 0.15
            lat = 19.10 - (y / mask.shape[0]) * 0.15

            coords.append([lon, lat])

        coords.append(coords[0])

        geojson_polygons.append(coords)

    return geojson_polygons
# ------------ Prediction Function ------------ #

def predict_oil_spill(image_path):

    image = tifffile.imread(image_path).astype(np.float32)

    tensor = torch.tensor(image).permute(2,0,1)
    tensor = Resize((256,256))(tensor)

    tensor = (tensor - tensor.min()) / (tensor.max()-tensor.min()+1e-8)

    tensor = tensor.unsqueeze(0).to(device)

    with torch.no_grad():
        pred = model(tensor)
        pred = torch.sigmoid(pred)

    pred = pred.squeeze().cpu().numpy()

# Better threshold for oil spill segmentation
    pred_binary = (pred > 0.55).astype(np.uint8)

# Remove tiny noisy regions
    kernel = np.ones((3, 3), np.uint8)
    pred_binary = cv2.morphologyEx(pred_binary, cv2.MORPH_OPEN, kernel)
    pred_binary = cv2.morphologyEx(pred_binary, cv2.MORPH_CLOSE, kernel)

# Confidence = average model probability
    confidence = float(pred.mean() * 100)

# Spill area (% of image predicted as spill)
    spill_area = round(
        (pred_binary.sum() / pred_binary.size) * 100,
        2
    )

    # Overlay
    vv = tensor.squeeze()[0].cpu().numpy()

    overlay = np.stack([vv,vv,vv],axis=-1)
    overlay = (overlay-overlay.min())/(overlay.max()-overlay.min()+1e-8)

    overlay[pred_binary==1] = [1,0,0]

    mask_img = Image.fromarray(pred_binary*255)
    overlay_img = Image.fromarray((overlay*255).astype(np.uint8))

    mask_array = np.array(mask_img)

    spill_polygon = []

    if spill_area > 0:
       spill_polygon = mask_to_geojson(mask_array)

    return (
        mask_img,
        overlay_img,
        confidence,
        spill_area,
        spill_polygon
    )

if __name__ == "__main__":
    print("Testing model loading...")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = UNet().to(device)
    model.load_state_dict(torch.load("oil_spill_unet.pth", map_location=device))
    model.eval()

    print("MODEL LOADED SUCCESSFULLY")