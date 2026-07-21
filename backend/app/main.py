from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.api.classify import router as classify_router
from app.model import predict_email
from app.schemas import EmailRequest, PredictionResponse


app = FastAPI(
    title="Sweep-N-Spam API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


app.include_router(classify_router)


@app.get("/")
def health():
    return {
        "status": "ok",
        "model_loaded": True,
    }


@app.get("/health")
def detailed_health():
    return {
        "status": "ok",
        "service": "Sweep-N-Spam API",
        "model_loaded": True,
    }


@app.post(
    "/predict",
    response_model=PredictionResponse,
)
def predict(req: EmailRequest):
    label, confidence = predict_email(
        req.subject,
        req.body,
    )

    label_map = {
        0: "not_important",
        1: "important",
        2: "review",
    }

    final_label = label_map.get(
        int(label),
        "review",
    )

    # Safety rule:
    # Low-confidence clutter predictions should require review.
    if final_label == "not_important" and confidence < 0.80:
        final_label = "review"

    return {
        "label": final_label,
        "confidence": round(
            float(confidence),
            4,
        ),
    }
