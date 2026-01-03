import random

def predict_email(subject: str, body: str):
    """
    MOCK model for now.
    Replaced later with real ML service / HTTP call.
    """
    label = random.choice([0, 1, 2])
    confidence = round(random.uniform(0.6, 0.99), 4)
    return label, confidence
