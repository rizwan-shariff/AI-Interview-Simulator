# AI-Based Smart Interview Simulator
**Comprehensive Project Documentation & Architecture**

---

## 1. Project Overview
The **AI Smart Interview Simulator** is a full-stack, multimodal web application designed to help job seekers practice technical and behavioral interviews. It creates a high-fidelity, high-pressure environment that mimics a real corporate interview.

It leverages state-of-the-art AI (Groq LLaMA 3) to:
- Dynamically generate role-specific questions from Job Descriptions.
- Transcribe and evaluate spoken audio/text answers in real-time.
- Silently analyze facial expressions and body language via webcam snapshots.
- Generate a comprehensive, downloadable Performance Dashboard PDF.

---

## 2. Tech Stack & Architecture

This project is built using a decoupled **Client-Server Architecture**:

### Frontend (User Interface)
- **Framework:** React + Vite (TypeScript)
- **Styling:** Tailwind CSS (Custom glassmorphism & cinematic theme)
- **Computer Vision:** TensorFlow.js (`@tensorflow-models/coco-ssd`)
- **PDF Generation:** `html2canvas-pro` + `jsPDF`
- **Deployment Strategy:** Vercel (Static SPA + Serverless API Functions)

### Backend (AI Processing)
- **Framework:** Python FastAPI
- **LLM Engine 1 (Text):** Groq API (`llama-3.3-70b-versatile`) for blazing-fast question generation and evaluation.
- **LLM Engine 2 (Vision):** Groq Vision (`llama-4-scout-17b`) for processing body language bounding boxes and facial expressions.
- **Web Scraping:** DuckDuckGo Search (for RAG context retrieval).
- **Deployment Strategy:** Render / Heroku / AWS (Stateless Python API).

### Communication Flow
1. **Frontend Request:** The React app sends the candidate's answers and base64 webcam snapshots to the Python backend via REST API (`POST /api/evaluate-answer`).
2. **Backend Execution:** The FastAPI server authenticates with Groq, retrieves ground-truth data from the web (RAG), and prompts the LLM to score the answer (Technical, Communication, Confidence).
3. **Frontend Dashboard:** The React app compiles all evaluations into a dynamic `DashboardView`.
4. **Vercel Serverless Function:** When the session completes, the frontend generates a PDF and sends it to `/api/share-results` (a Next.js/Vercel serverless function using `nodemailer` to bypass port blocking on Render).

---

## 3. Core Features Detailed Breakdown

### A. Dynamic Job Description Parsing
- **How it works:** Users paste a custom Job Description and select an Experience Level (Junior, Mid, Senior, Lead).
- **AI Logic:** The backend passes this to LLaMA 3, which acts as a technical recruiter. It extracts the core competencies and returns exactly $N$ custom technical and behavioral questions formatted as a strict JSON array.

### B. Interactive Live Engine & Webcam Monitoring
- **How it works:** During the interview, the browser accesses the candidate's webcam using `navigator.mediaDevices.getUserMedia`.
- **Anti-Cheat Logic:** If the user switches tabs (`visibilitychange` event), the app strikes them with a violation. Two violations result in immediate disqualification.
- **Body Language Analysis:** An invisible HTML `<canvas>` silently extracts one frame per question. At the end of the session, these frames are bundled and sent to the Vision API to assess eye contact, posture, and engagement.

### C. Web-Augmented Grading (RAG)
- **How it works:** AI hallucinations are dangerous in technical interviews. Before grading a candidate's answer, the backend runs a silent web search for the specific interview question.
- **AI Logic:** It feeds the "industry ground-truth" data from the web into the LLM prompt alongside the candidate's answer. This forces the AI to grade the candidate against real-world standards rather than its own internal biases.

### D. Automated PDF Scorecards & Email Dispatch
- **How it works:** At the end of the interview, `html2canvas-pro` takes a high-res snapshot of the React dashboard DOM. `jsPDF` converts it to a standard A4 document.
- **Email Logic:** Because many free-tier Python hosts (like Render) block outbound SMTP ports to prevent spam, the email dispatching is handled by a Vercel Serverless Function (`UI/api/share-results.js`). This function uses Gmail SMTP (`nodemailer`) to instantly email the PDF to the candidate upon completion.

---

## 4. Setup & Local Development

### Prerequisites
- Node.js v18+
- Python 3.10+

### Step 1: Backend Setup (Python)
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Create a `.env` file in the `backend/` directory:
   ```env
   GROQ_API_KEY="your_groq_key_here"
   ```
4. Start the FastAPI server: `uvicorn main:app --reload` (Runs on port 8000).

### Step 2: Frontend Setup (React)
1. Navigate to the UI directory: `cd UI`
2. Install dependencies: `npm install`
3. Start the Vite dev server: `npm run dev` (Runs on port 3000).

*Note: In local development, the frontend automatically routes API calls to `http://localhost:8000`.*

---

## 5. Deployment Instructions

### Deploying the Backend
The backend can be deployed to any Python host (e.g., Render, Railway, AWS ECS). Ensure you set the `GROQ_API_KEY` in the environment variables of your host.

### Deploying the Frontend (Vercel)
The frontend is optimized for **Vercel**.
1. Connect your GitHub repository to Vercel.
2. Set the Root Directory to `UI`.
3. Vercel will automatically detect Vite and run `npm run build`.
4. **Environment Variables:** No need to configure SMTP keys on Vercel, as they are securely embedded within the serverless function logic (`api/share-results.js`). Just ensure the backend URL is properly mapped if the default Render string is altered.
