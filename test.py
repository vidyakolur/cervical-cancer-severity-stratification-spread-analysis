from fastapi import FastAPI
import torch
import torchvision.models as models
from torchvision import transforms
from PIL import Image
import os

app = FastAPI()

# -------------------------
# CONFIG
# -------------------------

NUM_CLASSES = 5

classes = [
    "Dyskeratotic",
    "Koilocytic",
    "Metaplastic",
    "Parabasal",
    "Superficial-Intermediate"
]

BASE_DIR = os.path.dirname(__file__)

MODEL_PATH = os.path.join(BASE_DIR, "cervical_resnet50_final.pth")

# -------------------------
# LOAD MODEL SAFELY
# -------------------------

model = models.resnet50()
model.fc = torch.nn.Linear(model.fc.in_features, NUM_CLASSES)

try:
    model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
    model.eval()
except Exception as e:
    print("Model load failed:", e)

# -------------------------
# TRANSFORM
# -------------------------

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        [0.485, 0.456, 0.406],
        [0.229, 0.224, 0.225]
    )
])

# -------------------------
# API ROUTES
# -------------------------

@app.get("/")
def home():
    return {"message": "API is running 🚀"}

@app.post("/predict")
def predict():
    image_path = os.path.join(BASE_DIR, "test22.jpg")

    if not os.path.exists(image_path):
        return {"error": "test22.jpg not found in project folder"}

    img = Image.open(image_path).convert("RGB")
    img = transform(img).unsqueeze(0)

    with torch.no_grad():
        output = model(img)
        pred = torch.argmax(output, 1)

    return {
        "class_index": int(pred.item()),
        "class_name": classes[pred.item()]
    }