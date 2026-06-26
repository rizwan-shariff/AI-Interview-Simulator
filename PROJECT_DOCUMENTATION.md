# AI-Based Smart Interview Simulator
**Comprehensive Project Documentation**

---

## 1. Project Overview
The AI Smart Interview Simulator is a full-stack, multimodal web application built to help job seekers practice technical and behavioral interviews. It leverages Google's Gemini LLMs to dynamically generate role-specific questions, transcribe spoken audio answers, analyze facial expressions and body language in real-time, fetch industry-standard answers from the web, and provide comprehensive, structured feedback.

## 2. How to Run the Project

### Prerequisites
- Python 3.10+ installed on your machine.
- A functional webcam and microphone.

### Setup Instructions
1. **Navigate to the project directory:** Open your terminal and `cd` into the project folder.
2. **Install Dependencies:** Run the following command to install all required libraries:
   ```bash
   pip install -r requirements.txt
   ```
3. **Configure API Keys:** Ensure your `.env` file is set up (see section 3).
4. **Launch the Application:** Run the Streamlit server using the command:
   ```bash
   streamlit run app.py
   ```
5. **Access the App:** Open the local URL (usually `http://localhost:8501`) provided in your terminal in a web browser.

---

## 3. API Keys Configuration
This project relies heavily on Google's Gemini API for its intelligence. 

- **GEMINI_API_KEY (Main):** This is the primary API key used to generate questions and grade your text/audio answers. It must be placed in a file named `.env` in the root directory like so: `GEMINI_API_KEY="your_key_here"`.
- **VISION_API_KEY (Optional Fallback):** Video frame analysis uses a massive amount of tokens. To prevent hitting free-tier rate limits, the app supports an optional secondary key in the `.env` file (`VISION_API_KEY="your_second_key_here"`). If provided, the app intelligently routes all heavy body-language evaluations to this secondary account.

---

## 4. Libraries and Tech Stack
Here is a breakdown of the imported libraries and why they are used:

- **`streamlit`:** The core framework. It handles the entire frontend UI (buttons, sidebars, tabs) and automatically connects it to the backend Python logic without requiring raw HTML/JS.
- **`google.generativeai`:** The official SDK for communicating with Google's Gemini models. It powers the dynamic question generation and the strict JSON-based grading rubrics.
- **`speech_recognition`:** Used to capture audio from the microphone and transcribe it into text using Google's free speech-to-text service.
- **`gTTS` (Google Text-to-Speech):** Converts the AI-generated text questions into MP3 audio files so the user can physically listen to the interviewer.
- **`streamlit_webrtc` & `cv2` (OpenCV):** Used to embed a live, continuous video stream into the browser and silently extract frame snapshots (`numpy` arrays) in the background.
- **`PIL.Image`:** Used to convert OpenCV frames into standard Image objects that Gemini's Multimodal Vision model can process.
- **`duckduckgo_search`:** Used to perform silent, live web scraping. Before grading an answer, the app searches the web for the "industry standard" answer to give the AI context.
- **`pandas` & `altair`:** Used for data manipulation and rendering the interactive performance bar charts on the final dashboard.

---

## 5. Frontend & Backend Architecture

Unlike traditional applications (like React + Node.js), this project uses **Streamlit**, which blurs the line between frontend and backend. 

- **The Frontend (UI State):** The frontend is defined by Streamlit widgets (`st.text_input`, `st.button`, `webrtc_streamer`). When a user interacts with a widget (e.g., clicking "Submit Answer"), the frontend sends a signal to the backend.
- **The Backend (Execution):** The Python script runs top-to-bottom on a server. It uses `st.session_state` as a backend database to remember things (like the `interview_history`, `current_q_index`, and `all_snapshots`) across page reloads.
- **Communication:** When you click "Submit", the frontend pauses, the backend Python logic updates the state variables, writes your answer to `interview_transcript.txt`, and issues a `st.rerun()` command. This tells the frontend to instantly redraw itself with the next question.

---

## 6. Tackling the API Rate Limit Bottleneck
During development, the biggest hurdle was the **`429 Quota Exceeded`** error. The Google Gemini Free Tier limits users to exactly 15 Requests-Per-Minute (RPM). Because the app was searching the web, generating Q's, and grading answers rapidly, it crashed frequently.

We engineered two major solutions to tackle this:
1. **Exponential Backoff (`call_with_retry`):** We wrapped every single API call in a custom retry function. If the app detects a rate limit, it doesn't crash. Instead, it pauses for 10 seconds, tries again, then 20 seconds, then 40 seconds. This allows the app to gracefully "wait out" the Google server limits.
2. **Bulk Evaluation Architecture:** Instead of evaluating every answer individually (which costs 5 API calls for 5 questions), the app now caches all answers locally in `interview_transcript.txt`. At the very end of the interview, it bundles the *entire transcript* into a single, massive API prompt. This reduces the API load by 80% and ensures the user never experiences loading delays during the actual interview.

---

## 7. Project Defense (Judge Q&A)

*If a judge were to evaluate this project, here are the questions they might ask, and how you should answer them:*

**Judge: "Why did you choose Streamlit instead of a traditional React frontend?"**
> **Answer:** "Given the heavy reliance on Python libraries like OpenCV for frame extraction and SpeechRecognition for audio, building a separate Node/React backend would have introduced unnecessary latency and complex WebSocket architecture for video streaming. Streamlit allowed us to tightly couple our AI logic with the UI, drastically reducing development time while maintaining a clean, modern aesthetic."

**Judge: "How do you ensure the AI's grading is actually accurate and not hallucinated?"**
> **Answer:** "We implemented a technique called RAG (Retrieval-Augmented Generation). Before Gemini grades the user, our backend silently pings DuckDuckGo to scrape top search results for the specific interview question. We feed this 'industry ground-truth' data to Gemini in the prompt, forcing it to grade the candidate against real-world standards rather than its own internal biases."

**Judge: "Body language analysis is computationally expensive. How are you processing video without freezing the web page?"**
> **Answer:** "We don't send raw video to the AI. We use `streamlit-webrtc` to run a lightweight VideoProcessor thread in the background. It silently samples exactly one frame per question at the exact moment the user hits 'Submit'. At the end of the interview, we send that small, optimized batch of images to the Gemini Multimodal model for bulk evaluation."

**Judge: "What happens if a user inputs gibberish or the speech-to-text fails?"**
> **Answer:** "The application is built with robust error handling. If `speech_recognition` fails to understand the audio due to background noise, it catches the `UnknownValueError` and gracefully prompts the user to either try again or switch to the manual text-input fallback."
