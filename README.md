# Sweep 'n Spam

Deep Learning–Driven Email Cleaner for Gmail

Sweep ’n Spam is a Chrome Extension designed to help users achieve Inbox Zero by automatically identifying and removing low-priority emails such as promotions, newsletters, and spam. Instead of relying on heuristic rules or keyword matching, the system uses a fine-tuned DistilBERT classifier to perform contextual email classification, enabling reliable separation of important and unimportant messages.

This project is a demonstration of how modern NLP deep learning models can be integrated into real-world consumer software through a local, privacy-preserving architecture.

## Key Features


### Contextual Email Classification (Deep Learning)
Uses a fine-tuned DistilBERT model to classify emails as *Important* or *Unimportant* based on semantic context rather than surface-level keywords.

### Local Inference & Privacy-Preserving Design
All model inference runs locally via a Python backend. Email content is never transmitted to external servers, ensuring full user data privacy.

### High-Throughput Bulk Processing
Efficiently scans and classifies large batches of emails, enabling one-click cleanup of inbox clutter.

### Native Browser Integration
Delivered through a Chrome Side Panel interface for seamless interaction within Gmail.


## Tech Stack


### Frontend
Chrome Extension (Manifest V3), HTML5, CSS3, JavaScript

### Backend
Python 3.x, FastAPI

### Deep Learning & NLP
PyTorch, Hugging Face Transformers (DistilBERT), Scikit-learn


---

## Installation Guide


Follow these steps to set up the project locally.

### Step 1: Clone the Repository

git clone https://github.com/Sattei/Sweep-N-Spam
cd sweep-n-spam

### Step 2: Backend Setup (Deep Learning Inference Server)

The backend is responsible for running the trained classification model and exposing REST endpoints.

1.  Navigate to the backend directory:
    cd backend

2.  Install the required libraries:
    pip install -r requirements.txt

3.  **IMPORTANT: Download the Model**
    The trained model file is too large for GitHub, so you must download it separately.

    - **Download Link:** https://drive.google.com/drive/folders/1wpnXBwCb4dVeyRNi58EWVOTOJ9_ZyqXy?usp=drive_link
    - Download the file (likely named email_classifier_pytorch).
    - Place it directly inside the `backend/` folder.

4.  Start the server:
    uvicorn app.main:app --reload

    You should see a message saying the server is running at http://127.0.0.1:8000.

### Step 3: Setup the Frontend (Chrome Extension)

NOTE: Google client id must be generated from the Google Console and linked with the extension's local id for Google OAuth.

1.  Open Google Chrome and go to `chrome://extensions`.
2.  Enable **Developer Mode** using the toggle in the top-right corner.
3.  Click the **Load Unpacked** button in the top-left.
4.  Select the `extension` folder from this repository.
5.  The extension is now installed and ready to use.

---

## How to Use

1.  **Start the Backend:** Ensure your Python server is running (`python app.py`).
2.  **Open Gmail:** Go to your Gmail tab in Chrome.
3.  **Open the Side Panel:** Click the extension icon and select "Open Side Panel".
4.  **Login:** Click the "Login" button to authorize Gmail access.
5.  **Scan:** Click "Scan New (50)" to analyze your latest emails.
6.  **Clean:** The AI will check the boxes for junk mail automatically. Review the list, then click "Move Selected to Trash".

---

## Project Structure

```text
sweep-n-spam/
├── backend/                 # Python FastAPI Server
│   ├── app.py               # API Endpoints
│   ├── model.py             # Model Class Definition
│   ├── spam_classifier.pth  # Trained Model (download separately)
│   └── requirements.txt     # Python dependencies
│
├── extension/               # Chrome Extension Files
│   ├── manifest.json        # Config & Permissions
│   ├── sidepanel.html       # UI Layout
│   ├── sidepanel.js         # Frontend Logic
│   └── icons/               # App Icons
│
└── README.md                # Project Documentation
```

## Happy sweeping!
---
