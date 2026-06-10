import sqlite3
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from face_engine import FaceRecognitionEngine

app = FastAPI(title="Smart Biometric Voting System Engine")

# Configure CORS cross-origin allowances so your React app can hit this backend safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # During vibe-coding development, accept all web hooks
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize our AI facial structure model
engine = FaceRecognitionEngine(threshold=0.6)

def init_db():
    """Build local schema relational files to hold structured voting cards securely."""
    conn = sqlite3.connect("data/voter_registry.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS voters (
            voter_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            has_voted INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

@app.post("/register")
async def register_voter(
    voter_id: str = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...)
):
    image_bytes = await file.read()
    success, message = engine.register_voter(voter_id, image_bytes)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
        
    # Write metadata to the SQLite table
    conn = sqlite3.connect("data/voter_registry.db")
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO voters (voter_id, name) VALUES (?, ?)", (voter_id, name))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Voter ID profile already exists in ledger.")
    conn.close()
    
    return {"status": "Success", "message": f"Successfully enrolled voter registration profile: {name}"}

@app.post("/verify")
async def verify_voter(file: UploadFile = File(...)):
    image_bytes = await file.read()
    voter_id, message = engine.verify_voter(image_bytes)
    
    if not voter_id:
        raise HTTPException(status_code=401, detail=message)
        
    # Verify the voter has not already voted
    conn = sqlite3.connect("data/voter_registry.db")
    cursor = conn.cursor()
    cursor.execute("SELECT name, has_voted FROM voters WHERE voter_id = ?", (voter_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Biometric key matched vector files but no SQL metadata match.")
        
    name, has_voted = row
    if has_voted == 1:
        raise HTTPException(status_code=403, detail=f"Access Denied. Voter {name} has already cast a ballot.")
        
    return {"status": "Verified", "voter_id": voter_id, "name": name}

@app.post("/cast-vote")
async def cast_vote(voter_id: str = Form(...), candidate: str = Form(...)):
    conn = sqlite3.connect("data/voter_registry.db")
    cursor = conn.cursor()
    
    # Verify voter standing state one more time before accepting ballot ledger commit
    cursor.execute("SELECT has_voted FROM voters WHERE voter_id = ?", (voter_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Invalid session token context identifier.")
    if row[0] == 1:
        conn.close()
        raise HTTPException(status_code=403, detail="Ballot duplication rejected.")
        
    # Process transactional ledger updates safely
    cursor.execute("UPDATE voters SET has_voted = 1 WHERE voter_id = ?", (voter_id,))
    cursor.execute("INSERT INTO votes (candidate) VALUES (?)", (candidate,))
    conn.commit()
    conn.close()
    
    return {"status": "Success", "message": f"Ballot cast securely for candidate: {candidate}"}