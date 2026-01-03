# Sweep 'n Spam

AI-Powered Email Cleaner for Gmail

Sweep 'n Spam is a smart Chrome Extension that helps you reach "Inbox Zero" by automatically identifying and deleting unimportant emails (promotions, spam, newsletters). Unlike basic keyword filters, this project uses a custom-trained Machine Learning model (DistilBERT) to "read" and understand the context of your emails, ensuring only actual clutter is removed.

## Key Features

- **AI-Powered Classification:** Uses a fine-tuned DistilBERT model to classify emails as "Important" or "Unimportant" with high accuracy.
- **Privacy First:** Your data stays private. The analysis happens locally on your machine via a Python backend—no emails are ever sent to external third-party servers.
- **Bulk Action:** Scan hundreds of emails in seconds and delete junk in one click.
- **Seamless UI:** Integrated directly into the browser via a modern Chrome Side Panel.

## Tech Stack

- **Frontend:** Chrome Extension (Manifest V3), HTML5, CSS3, JavaScript
- **Backend:** Python 3.x, FastAPI
- **Machine Learning:** PyTorch, HuggingFace Transformers, Scikit-learn

---

## Installation Guide

Follow these steps to set up the project locally.

### Step 1: Clone the Repository

Open your terminal and run:

git clone https://github.com/Sattei/Sweep-N-Spam
cd sweep-n-spam

### Step 2: Setup the Backend (Python)

The backend runs the AI model.

1.  Navigate to the backend folder:
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

sweep-n-spam/
├── backend/ # Python FastAPI Server
│ ├── app.py # API Endpoints
│ ├── model.py # Model Class Definition
│ ├── spam_classifier.pth # Trained Model (Download separately)
│ └── requirements.txt # Python dependencies
│
├── extension/ # Chrome Extension Files
│ ├── manifest.json # Config & Permissions
│ ├── sidepanel.html # UI Layout
│ ├── sidepanel.js # Frontend Logic
│ └── icons/ # App Icons
│
└── README.md # Project Documentation

## Note for Recruiters/Developers

This project demonstrates a full-stack implementation of a local AI tool, bridging the gap between raw ML models (PyTorch) and practical consumer software (Browser Extensions). It handles OAuth2 authentication, REST API communication, and efficient DOM manipulation.

---

**Author:** [Your Name]
**GitHub:** [Your GitHub Profile Link]
