from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
import os
from dotenv import load_dotenv
import json
from io import BytesIO
from PIL import Image

# Import existing logic
from ai_services import generate_questions, evaluate_single_answer, generate_summary, evaluate_body_language
from utils import search_web_for_answer

load_dotenv()

app = FastAPI(title="AI Interview Simulator API")

# Allow Next.js frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateQuestionsRequest(BaseModel):
    jobDescription: str
    experienceLevel: str
    numQuestions: int

class EvaluateAnswerRequest(BaseModel):
    question: str
    answer: str
    jobDescription: str
    experienceLevel: str

class GenerateSummaryRequest(BaseModel):
    rounds: List[Any]
    jobDescription: str
    experienceLevel: str

@app.get("/")
def read_root():
    return {"message": "AI Interview Simulator Backend is Running!"}

@app.post("/api/generate-questions")
async def api_generate_questions(req: GenerateQuestionsRequest):
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
        
    questions = generate_questions(req.jobDescription, req.experienceLevel, req.numQuestions, groq_api_key)
    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate questions")
        
    return {"questions": questions}

@app.post("/api/evaluate-answer")
async def api_evaluate_answer(req: EvaluateAnswerRequest):
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    # 1. Get Web Context
    web_context = search_web_for_answer(req.question)
    
    # 2. Evaluate
    evaluation = evaluate_single_answer(req.question, req.answer, web_context, req.jobDescription, req.experienceLevel, groq_api_key)
    
    return {"evaluation": evaluation}

@app.post("/api/generate-summary")
async def api_generate_summary(req: GenerateSummaryRequest):
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    summary = generate_summary(req.rounds, req.jobDescription, req.experienceLevel, groq_api_key)
    
    return {"summary": summary}

@app.post("/api/evaluate-body-language")
async def api_evaluate_body_language(images: List[UploadFile] = File(...)):
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    pil_images = []
    for file in images:
        contents = await file.read()
        image = Image.open(BytesIO(contents))
        pil_images.append(image)
        
    evaluation = evaluate_body_language(pil_images, groq_api_key)
    return {"evaluation": evaluation}
