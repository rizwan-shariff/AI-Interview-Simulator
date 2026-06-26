import json
import time
from groq import Groq
import base64
from io import BytesIO

def generate_questions(jobDescription, experienceLevel, numQuestions, groq_api_key):
    try:
        client = Groq(api_key=groq_api_key)
        prompt = f"""
        You are an elite corporate technical recruiter. Generate {numQuestions} interview questions for a candidate applying for a {experienceLevel}-level position.
        Job Description:
        {jobDescription}
        
        Provide a mix of technical and behavioral questions tailored to the role level.
        
        Return ONLY a valid JSON array of strings, where each string is a question. Do not include markdown formatting like ```json.
        Example: ["Question 1", "Question 2"]
        """
        
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an API that only returns valid JSON arrays. Do not output anything else."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
        
        text = chat_completion.choices[0].message.content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        questions = json.loads(text)
        return questions
    except Exception as e:
        print(f"Error generating questions with Groq: {e}")
        return []

def evaluate_single_answer(question, answer, web_context, jobDescription, experienceLevel, groq_api_key):
    try:
        client = Groq(api_key=groq_api_key)
        prompt = f"""
        You are an expert interviewer evaluating a candidate for a {experienceLevel}-level position.
        Job Description: {jobDescription}
        
        Question: {question}
        Candidate Answer: {answer}
        Industry Reference: {web_context}
        
        Evaluate the answer and provide a JSON object with exactly these keys:
        - "technicalScore": (int, 0-100) How accurate and deep is the technical knowledge based on the standard reference.
        - "communicationScore": (int, 0-100) How clear, structured, and grammatically correct the answer is.
        - "confidenceScore": (int, 0-100) Based on word choice and assertiveness.
        - "feedback": (string) Constructive feedback on what was good, what can be improved, and how they matched the standard reference.
        - "suggestions": (string) Actionable, precise tips on how the candidate can improve this specific answer.
        
        Return ONLY a valid JSON object. No markdown blocks.
        """
        
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an API that only returns a valid JSON object. Do not output anything else."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
        )
        
        text = chat_completion.choices[0].message.content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        evaluation = json.loads(text)
        return evaluation
    except Exception as e:
        print(f"Error evaluating answer with Groq: {e}")
        return {
            "technicalScore": 0,
            "communicationScore": 0,
            "confidenceScore": 0,
            "feedback": f"Evaluation failed: {str(e)}",
            "suggestions": "Try again later."
        }

def generate_summary(rounds, jobDescription, experienceLevel, groq_api_key):
    try:
        client = Groq(api_key=groq_api_key)
        prompt = f"""
        Analyze this completed interview session containing multiple question-and-answer rounds.
        Role: {experienceLevel}-level position.
        Job Description: {jobDescription}
        
        Rounds:
        {json.dumps(rounds, indent=2)}
        
        Provide an aggregate analysis with exactly these JSON keys:
        - "overallScore": (int, 0-100) Overall combined performance score.
        - "strengths": (array of strings) 2 or 3 bullet points detailing the candidate's strongest areas.
        - "opportunities": (array of strings) 2 or 3 bullet points detailing the candidate's areas for growth.
        - "trajectory": (array of ints) An array of exactly 4 integers representing the progressive score trajectory over the interview (e.g. [78, 85, 82, 92]).
        
        Return ONLY a valid JSON object. No markdown blocks.
        """
        
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an API that only returns a valid JSON object. Do not output anything else."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
        )
        
        text = chat_completion.choices[0].message.content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        summary = json.loads(text)
        return summary
    except Exception as e:
        print(f"Error generating summary with Groq: {e}")
        return {
            "overallScore": 0,
            "strengths": ["Failed to generate summary"],
            "opportunities": [str(e)],
            "trajectory": [0, 0, 0, 0]
        }

def evaluate_body_language(images, groq_api_key):
    if not images:
        return {"body_language_score": 0, "feedback": "No images provided for evaluation."}
        
    try:
        client = Groq(api_key=groq_api_key)
        
        content = [
            {
                "type": "text",
                "text": "Evaluate their body language and provide a JSON response with exactly these keys:\n- 'body_language_score': (int, 1-10)\n- 'feedback': (string)\nReturn ONLY valid JSON. No markdown blocks."
            }
        ]
        
        for img in images:
            img.thumbnail((512, 512))
            buffered = BytesIO()
            img.save(buffered, format="JPEG")
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{img_str}"
                }
            })
            
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": content
                }
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.3,
        )
        
        text = chat_completion.choices[0].message.content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        return json.loads(text)
    except Exception as e:
        print(f"Body language evaluation error: {e}")
        return {"body_language_score": 0, "feedback": f"Vision evaluation failed: {str(e)}"}
