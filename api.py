from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
import torchvision.models as models
from torchvision import transforms
from PIL import Image
import io
import torch.nn.functional as F

# ✅ NEW
import numpy as np
import cv2
import base64
from pydantic import BaseModel
from datetime import datetime

class AIResult(BaseModel):
    prediction: str
    confidence: float
    severity: str

class ReviewRequest(BaseModel):
    patient_id: str
    ai_result: AIResult
    doctor_decision: str
    notes: str
    reviewed_by: str

# Temporary in-memory DB for reviews
reviews_db = []

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NUM_CLASSES = 5

classes = [
    "Dyskeratotic",
    "Koilocytic",
    "Metaplastic",
    "Parabasal",
    "Superficial-Intermediate"
]

# ✅ NEW: explanation
info = {
    "Dyskeratotic": "Abnormal keratinization, may indicate pre-cancerous changes.",
    "Koilocytic": "Associated with HPV infection.",
    "Metaplastic": "Normal transformation of cells.",
    "Parabasal": "Immature cells, may indicate inflammation.",
    "Superficial-Intermediate": "Normal healthy cells."
}

# ✅ NEW: severity
severity = {
    "Dyskeratotic": "High",
    "Koilocytic": "Medium",
    "Metaplastic": "Low",
    "Parabasal": "Low",
    "Superficial-Intermediate": "Normal"
}

# ✅ NEW: clinical follow-ups
follow_ups = {
    "Dyskeratotic": "Immediate colposcopy and biopsy recommended. High risk of high-grade squamous intraepithelial lesion (HSIL).",
    "Koilocytic": "Repeat Pap smear in 6 months. HPV testing recommended.",
    "Metaplastic": "Routine screening as per age guidelines. No immediate action required.",
    "Parabasal": "Evaluate for atrophy or inflammation. Treat underlying cause if symptomatic.",
    "Superficial-Intermediate": "Normal findings. Continue routine screening schedule."
}

# load model
model = models.resnet50()
model.fc = torch.nn.Linear(model.fc.in_features, NUM_CLASSES)
model.load_state_dict(torch.load("cervical_resnet50_final.pth", map_location="cpu"))
model.eval()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])

# ✅ Grad-CAM function
def generate_gradcam(model, image_tensor, size=(224, 224)):
    gradients = []
    activations = []

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    def forward_hook(module, input, output):
        activations.append(output)

    target_layer = model.layer4[-1]

    handle_f = target_layer.register_forward_hook(forward_hook)
    handle_b = target_layer.register_backward_hook(backward_hook)

    output = model(image_tensor)
    pred_class = output.argmax()

    model.zero_grad()
    output[0, pred_class].backward()

    grads = gradients[0]
    acts = activations[0]

    # Grad-CAM++ logic
    grads_power_2 = grads ** 2
    grads_power_3 = grads_power_2 * grads
    sum_activations = acts.sum(dim=[2, 3], keepdim=True)
    eps = 1e-7
    
    aij = grads_power_2 / (2 * grads_power_2 + sum_activations * grads_power_3 + eps)
    weights = (aij * torch.relu(grads)).sum(dim=[2, 3], keepdim=True)
    
    cam = (weights * acts).sum(dim=1).squeeze()

    cam = torch.relu(cam)
    cam = cam - cam.min()
    cam = cam / cam.max()

    cam = cam.detach().numpy()
    cam = cv2.resize(cam, size)

    handle_f.remove()
    handle_b.remove()

    return cam

def is_valid_cell_image(image_pil):
    """
    Validates if the image is likely a microscopic cell slide.
    """
    img_np = np.array(image_pil)
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    
    # Reject solid color / uniform images
    if np.var(gray) < 5.0:
        return False
        
    # Reject screenshots and UI templates by checking for long, straight lines.
    # Biological images rarely have multiple perfectly straight lines.
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=100, maxLineGap=10)
    
    if lines is not None and len(lines) > 5:
        return False
        
    return True

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        try:
            image = Image.open(io.BytesIO(contents)).convert("RGB")
        except:
            return {"error": "Invalid image file"}

        if not is_valid_cell_image(image):
            return {"validation_error": "Invalid image"}

        img = transform(image).unsqueeze(0)

        with torch.no_grad():
            output = model(img)
            probs = F.softmax(output, dim=1)
            pred = torch.argmax(probs, 1)

        # ✅ Grad-CAM with correct dimensions
        width, height = image.size
        cam = generate_gradcam(model, img, (width, height))

        heatmap = (cam * 255).astype(np.uint8)
        heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

        # Fix RGB -> BGR for opencv
        original_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        overlay = cv2.addWeighted(original_bgr, 0.6, heatmap, 0.4, 0)

        _, buffer = cv2.imencode('.jpg', overlay)
        heatmap_base64 = base64.b64encode(buffer).decode('utf-8')

        # ✅ Spread Analysis: Localization Map & Masked Image
        thresh = (cam > 0.6).astype(np.uint8) * 255
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # 1. Localization Map
        localization_bgr = original_bgr.copy()
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            cv2.rectangle(localization_bgr, (x, y), (x+w, y+h), (0, 255, 0), 3) # Green bounding boxes
        _, loc_buffer = cv2.imencode('.jpg', localization_bgr)
        localization_base64 = base64.b64encode(loc_buffer).decode('utf-8')

        # 2. Masked Image
        mask = (cam > 0.4).astype(np.uint8) # Slightly lower threshold for mask to get surrounding cells
        mask_3d = np.repeat(mask[:, :, np.newaxis], 3, axis=2)
        masked_bgr = original_bgr * mask_3d
        _, mask_buffer = cv2.imencode('.jpg', masked_bgr)
        masked_base64 = base64.b64encode(mask_buffer).decode('utf-8')

        # ✅ Smart Tile Gallery Extraction & Micro-Analysis
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8] # Top 8 clusters
        suspicious_tiles = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            # add margin
            margin = 30
            x1, y1 = max(0, x - margin), max(0, y - margin)
            x2, y2 = min(width, x + w + margin), min(height, y + h + margin)
            
            tile_bgr = original_bgr[y1:y2, x1:x2]
            # Ensure tile is not empty
            if tile_bgr.shape[0] > 0 and tile_bgr.shape[1] > 0:
                # Encode Image (for UI)
                _, tile_buffer = cv2.imencode('.jpg', tile_bgr)
                tile_base64 = base64.b64encode(tile_buffer).decode('utf-8')

                # Run Inference on Tile (using scale-preserved masked image to prevent zoom confusion)
                masked_tile_bgr = np.full_like(original_bgr, 255) # White background matches slide glass
                masked_tile_bgr[y1:y2, x1:x2] = tile_bgr
                tile_rgb = cv2.cvtColor(masked_tile_bgr, cv2.COLOR_BGR2RGB)
                tile_pil = Image.fromarray(tile_rgb)
                tile_tensor = transform(tile_pil).unsqueeze(0)
                with torch.no_grad():
                    tile_out = model(tile_tensor)
                    tile_probs = F.softmax(tile_out, dim=1)
                    tile_pred = torch.argmax(tile_probs, 1).item()
                
                suspicious_tiles.append({
                    "image": tile_base64,
                    "prediction": classes[tile_pred],
                    "confidence": float(tile_probs[0][tile_pred]),
                    "severity": severity[classes[tile_pred]]
                })

        return {
            "prediction": classes[pred.item()],
            "confidence": float(probs[0][pred.item()]),

            "description": info[classes[pred.item()]],
            "severity": severity[classes[pred.item()]],
            "follow_up": follow_ups[classes[pred.item()]],
            "all_probs": {
                classes[i]: float(probs[0][i]) for i in range(len(classes))
            },

            # 🔥 NEW
            "gradcam": heatmap_base64,
            "suspicious_tiles": suspicious_tiles,
            "localization_map": localization_base64,
            "masked_image": masked_base64
        }

    except Exception as e:
        return {"error": str(e)}

@app.post("/review")
async def submit_review(review: ReviewRequest):
    try:
        review_data = review.dict()
        review_data["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        reviews_db.append(review_data)
        print(f"New Pathologist Review Received for Patient {review.patient_id}: {review.doctor_decision}")
        return {"status": "success", "message": "Review saved successfully", "data": review_data}
    except Exception as e:
        return {"error": str(e)}