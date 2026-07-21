from pathlib import Path

import torch
from transformers import (
    DistilBertForSequenceClassification,
    DistilBertTokenizerFast,
)


LABEL_MAP = {
    0: "NOT_IMPORTANT",
    1: "IMPORTANT",
    2: "REVIEW",
}


BACKEND_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BACKEND_DIR / "email_classifier_pytorch"


if not MODEL_PATH.exists():
    raise RuntimeError(
        f"Model directory was not found at: {MODEL_PATH}"
    )


required_files = [
    MODEL_PATH / "config.json",
    MODEL_PATH / "model.safetensors",
]

missing_files = [
    str(file_path)
    for file_path in required_files
    if not file_path.exists()
]

if missing_files:
    raise RuntimeError(
        "Required model files are missing:\n"
        + "\n".join(missing_files)
    )


device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print(f"Loading model from: {MODEL_PATH}")
print(f"Using device: {device}")


tokenizer = DistilBertTokenizerFast.from_pretrained(
    str(MODEL_PATH),
    local_files_only=True,
)

model = DistilBertForSequenceClassification.from_pretrained(
    str(MODEL_PATH),
    local_files_only=True,
)

model.to(device)
model.eval()

print("Model loaded successfully.")


def predict_email(subject: str, body: str):
    subject = subject or ""
    body = body or ""

    text = f"{subject} {body}".strip()

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=256,
    )

    inputs = {
        key: value.to(device)
        for key, value in inputs.items()
    }

    with torch.no_grad():
        outputs = model(**inputs)

        probabilities = torch.softmax(
            outputs.logits,
            dim=1,
        )

        confidence, prediction = torch.max(
            probabilities,
            dim=1,
        )

    return prediction.item(), confidence.item()
