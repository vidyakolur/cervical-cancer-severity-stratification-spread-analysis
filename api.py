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
def generate_gradcam(model, image_tensor):
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

    weights = grads.mean(dim=[2, 3], keepdim=True)
    cam = (weights * acts).sum(dim=1).squeeze()

    cam = torch.relu(cam)
    cam = cam - cam.min()
    cam = cam / cam.max()

    cam = cam.detach().numpy()
    cam = cv2.resize(cam, (224, 224))

    handle_f.remove()
    handle_b.remove()

    return cam

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        try:
            image = Image.open(io.BytesIO(contents)).convert("RGB")
        except:
            return {"error": "Invalid image file"}

        img = transform(image).unsqueeze(0)

        with torch.no_grad():
            output = model(img)
            probs = F.softmax(output, dim=1)
            pred = torch.argmax(probs, 1)

        # ✅ Grad-CAM
        cam = generate_gradcam(model, img)

        heatmap = (cam * 255).astype(np.uint8)
        heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

        original = cv2.resize(np.array(image), (224, 224))
        overlay = cv2.addWeighted(original, 0.6, heatmap, 0.4, 0)

        _, buffer = cv2.imencode('.jpg', overlay)
        heatmap_base64 = base64.b64encode(buffer).decode('utf-8')

        return {
            "prediction": classes[pred.item()],
            "confidence": float(probs[0][pred.item()]),

            "description": info[classes[pred.item()]],
            "severity": severity[classes[pred.item()]],
            "all_probs": {
                classes[i]: float(probs[0][i]) for i in range(len(classes))
            },

            # 🔥 NEW
            "gradcam": heatmap_base64
        }

    except Exception as e:
        return {"error": str(e)}