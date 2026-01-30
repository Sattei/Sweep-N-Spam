import os
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification

# Label mapping (unchanged)
LABEL_MAP = {
    0: "NOT_IMPORTANT",
    1: "IMPORTANT",
    2: "REVIEW"
}

# Device selection
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Hugging Face model repo (NOT a local path)
MODEL_NAME = "Sattei/clutter-cleaner-email-classifier"

# Hugging Face token from environment variable
HF_TOKEN = os.getenv("HF_TOKEN")

if HF_TOKEN is None:
    raise RuntimeError(
        "HF_TOKEN environment variable not set. "
        "Add it in Railway or your local environment."
    )

# Load tokenizer and model from Hugging Face Hub
tokenizer = DistilBertTokenizerFast.from_pretrained(
    MODEL_NAME,
    token=HF_TOKEN
)

model = DistilBertForSequenceClassification.from_pretrained(
    MODEL_NAME,
    token=HF_TOKEN
)

model.to(device)
model.eval()

def predict_email(subject: str, body: str):
    text = subject + " " + body

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=256
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)
        confidence, pred = torch.max(probs, dim=1)

    return pred.item(), confidence.item()
