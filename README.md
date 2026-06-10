# Smart Biometric Voting System

A secure, full-stack web application designed for electronic voting authentication utilizing local AI facial biometric workflows. The platform handles multi-phase registration, real-time webcam frame tracking, face feature map transformations, and mathematical distance categorization matching to prevent duplicate voting ledger conflicts.

---

## 🛠️ Tech Stack & System Infrastructure

The platform uses a split-process decoupled architecture to isolate high-intensity computer vision models from the responsive frontend client dashboard.

### 1. Frontend Interface (`/frontend`)
* **Core Architecture:** React (scaffolded via Vite)
* **Design Framework:** Tailwind CSS v4 (Light-theme dashboard architecture optimized with high contrast view layouts)
* **Hardware Hooks:** `react-webcam` for async camera matrix streaming
* **Visual Assets:** `lucide-react` modern minimalist iconography

### 2. Backend API Service (`/backend`)
* **Core Server:** FastAPI (ASGI web-server running locally via Uvicorn)
* **Metadata Ledger:** SQLite3 (Relational structural engine logging ballot counts and voter status fields)
* **Serialization Data Structure:** Pickle-based vector dictionary lookup file (`voter_embeddings.pkl`)

### 3. Machine Learning & Computer Vision Core
* **Face Tracking & Segmentation:** Ultralytics YOLOv8 (Using a specialized `yolov8n-face.pt` network architecture)
* **Structural Feature Extraction:** `facenet-pytorch` model pre-trained on `vggface2` from Hugging Face
* **Classification Engine:** Scikit-Learn `KNeighborsClassifier` (K-Nearest Neighbors implementation)

---

## 🧠 Biometric Engine AI Pipeline

The verification mechanism executes sequentially across three distinct artificial intelligence layers whenever a face frame is fed to the API service:

```text
[ Webcam Capture ] ──> [ YOLOv8 Face Filter ] ──> [ Hugging Face InceptionResnetV1 ] ──> [ KNN Classifier ]
