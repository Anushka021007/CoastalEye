from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Oil spill detection API is running"}