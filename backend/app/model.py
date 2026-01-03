import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification

# LABEL_MAP is kept here for reference, but we return the raw ID now
LABEL_MAP = {
    0: "NOT_IMPORTANT",
    1: "IMPORTANT",
    2: "REVIEW"
}

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load model from local folder
tokenizer = DistilBertTokenizerFast.from_pretrained(
    "email_classifier_pytorch"
)

model = DistilBertForSequenceClassification.from_pretrained(
    "email_classifier_pytorch"
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

    # --- THE FIX IS HERE ---
    # Return pred.item() (integer) so main.py can use it safely.
    return pred.item(), confidence.item()