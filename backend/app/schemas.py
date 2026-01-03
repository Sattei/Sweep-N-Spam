from pydantic import BaseModel

class EmailRequest(BaseModel):
    subject: str
    body: str

class PredictionResponse(BaseModel):
    label: str
    confidence: float
