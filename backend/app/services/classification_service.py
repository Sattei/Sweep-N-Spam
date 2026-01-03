from app.services.model_client import predict_email

LABEL_MAP = {
    0: "NOT_IMPORTANT",
    1: "IMPORTANT",
    2: "REVIEW"
}

def classify_message(subject: str, snippet: str):
    label, confidence = predict_email(subject, snippet)

    if label not in LABEL_MAP:
        raise ValueError("Invalid label returned by model")

    return {
        "label": label,
        "meaning": LABEL_MAP[label],
        "confidence": confidence
    }
