from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.schemas import EmailRequest, PredictionResponse
from app.model import predict_email
from app.api.classify import router as classify_router

app = FastAPI(title="Gmail Importance Classifier")

# ---------- CORS ----------
# Allows Chrome Extension to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- ROUTERS ----------
app.include_router(classify_router)

# ---------- HEALTH ----------
@app.get("/")
def health():
    return {"status": "ok"}

# ---------- PREDICTION ----------
@app.post("/predict", response_model=PredictionResponse)
def predict(req: EmailRequest):
    label, confidence = predict_email(req.subject, req.body)

    # map numeric model output to string labels
    label_map = {
        0: "not_important",
        1: "important",
        2: "important"
    }

    return {
        "label": label_map.get(int(label), "unknown"),
        "confidence": round(float(confidence), 4),
    }
