from fastapi import APIRouter
from app.services.classification_service import classify_message

router = APIRouter(prefix="/classify", tags=["classification"])

@router.post("/single")
def classify_single(subject: str, snippet: str):
    return classify_message(subject, snippet)


@router.post("/batch")
def classify_batch(emails: list[dict]):
    results = []

    for email in emails:
        result = classify_message(
            email.get("subject", ""),
            email.get("snippet", "")
        )
        results.append({
            "id": email.get("id"),
            **result
        })

    return results
