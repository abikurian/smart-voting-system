import os
import pickle
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from facenet_pytorch import InceptionResnetV1
from sklearn.neighbors import KNeighborsClassifier

class FaceRecognitionEngine:
    def __init__(self, embedding_dir="data", threshold=0.6):
        self.embedding_dir = embedding_dir
        self.threshold = threshold
        self.embeddings_file = os.path.join(embedding_dir, "voter_embeddings.pkl")
        
        os.makedirs(embedding_dir, exist_ok=True)
        
        # 1. Load YOLOv8 face detection model (downloads automatically if not present)
        # We use a lightweight face-focused weight file
        model_path = "yolov8n-face.pt"
        if not os.path.exists(model_path):
            print(f"Downloading {model_path} face detection model weights...")
            import urllib.request
            url = "https://huggingface.co/Bingsu/adetailer/resolve/main/face_yolov8n.pt"
            urllib.request.urlretrieve(url, model_path)
            print(f"Finished downloading {model_path}.")
        self.detector = YOLO(model_path)
        
        # 2. Load Pre-trained Hugging Face / PyTorch Face Embedding Model
        self.encoder = InceptionResnetV1(pretrained="vggface2").eval()
        
        # Local data structure lookup maps
        self.registered_voters = {}  # {index: voter_id}
        self.knn = None
        self.load_database()

    def load_database(self):
        """Loads registered face embeddings from disk and trains the local KNN structure."""
        if os.path.exists(self.embeddings_file):
            with open(self.embeddings_file, "rb") as f:
                data = pickle.load(f)
                embeddings = data.get("embeddings", [])
                labels = data.get("labels", [])
                self.registered_voters = data.get("voters_map", {})
                
                if len(embeddings) > 0:
                    # Initialize KNN with 1 neighbor to look for exact closest matches
                    self.knn = KNeighborsClassifier(n_neighbors=1, metric="euclidean")
                    self.knn.fit(np.array(embeddings), np.array(labels))
                    print(f" Loaded database with {len(embeddings)} registered faces.")
        else:
            print(" No voter database found. Ready to register new users.")

    def save_database(self, embeddings, labels):
        """Saves memory state back into the local file structure."""
        with open(self.embeddings_file, "wb") as f:
            pickle.dump({
                "embeddings": embeddings,
                "labels": labels,
                "voters_map": self.registered_voters
            }, f)
        self.load_database()

    def get_face_embedding(self, image_bytes):
        """Processes raw image bytes through YOLO and InceptionResnetV1."""
        # Convert bytes into an OpenCV matrix
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Invalid image file provided.")

        # Step 1: Detect bounding boxes using YOLO
        results = self.detector(img, verbose=False)
        boxes = results[0].boxes
        
        if len(boxes) == 0:
            return None, "No face detected in the frame."

        # Grab the face with the highest confidence score
        best_box = max(boxes, key=lambda b: float(b.conf[0]))
        x1, y1, x2, y2 = map(int, best_box.xyxy[0])
        
        # Crop out everything except the identified face area
        cropped_face = img[max(0, y1):y2, max(0, x1):x2]
        if cropped_face.size == 0:
            return None, "Face tracking crop matrix error."

        # Step 2: Convert crop for the pre-trained embedding encoder
        cropped_rgb = cv2.cvtColor(cropped_face, cv2.COLOR_BGR2RGB)
        resized_face = cv2.resize(cropped_rgb, (160, 160))
        
        # Format image to PyTorch tensor format: (Channels, Height, Width), normalized
        face_tensor = torch.tensor(resized_face, dtype=torch.float32).permute(2, 0, 1)
        face_tensor = (face_tensor - 127.5) / 128.0
        face_tensor = face_tensor.unsqueeze(0)  # Add batch dimension

        # Step 3: Extract the 512-dimensional vector feature map
        with torch.no_grad():
            embedding = self.encoder(face_tensor).numpy().flatten()
            
        return embedding, None

    def register_voter(self, voter_id, image_bytes):
        """Extracts embedding vector and commits it to the internal KNN index mappings."""
        embedding, error = self.get_face_embedding(image_bytes)
        if error:
            return False, error

        # Load existing collection to append
        embeddings, labels = [], []
        if os.path.exists(self.embeddings_file):
            with open(self.embeddings_file, "rb") as f:
                data = pickle.load(f)
                embeddings = data.get("embeddings", [])
                labels = data.get("labels", [])

        # Assign an integer label sequence mapping to the text string voter_id
        new_label_idx = len(self.registered_voters)
        self.registered_voters[new_label_idx] = voter_id
        
        embeddings.append(embedding)
        labels.append(new_label_idx)
        
        self.save_database(embeddings, labels)
        return True, "Voter successfully enrolled."

    def verify_voter(self, image_bytes):
        """Queries the live embedding space via KNN to safely resolve authorization distance."""
        if self.knn is None:
            return None, "System database is currently empty. No voter profiles are enrolled."

        embedding, error = self.get_face_embedding(image_bytes)
        if error:
            return None, error

        # Use KNN to fetch the closest matched neighbor distance score
        distances, indices = self.knn.kneighbors([embedding], n_neighbors=1)
        min_distance = distances[0][0]
        matched_label = indices[0][0]

        # Security check: If the distance is too large, it means the face looks completely different
        if min_distance > self.threshold:
            return None, f"Face does not match any registered voter profile (Distance: {min_distance:.4f})."

        matched_voter_id = self.registered_voters[matched_label]
        return matched_voter_id, f"Profile verified successfully (Distance: {min_distance:.4f})."