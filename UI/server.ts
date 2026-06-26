/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Fallback questions for demo mode
const FALLBACK_QUESTIONS: Record<string, string[]> = {
  Junior: [
    "What is the difference between let, const, and var in JavaScript?",
    "Can you explain the virtual DOM and how React uses it to render components?",
    "How do you pass data between parent and child components in React?",
    "What are React Hooks and why were they introduced?",
    "How do you handle error boundaries or basic errors in an application?",
  ],
  Mid: [
    "Tell me about a time you resolved a conflict within a technical team.",
    "Explain the concept of closure in JavaScript and give a practical use case.",
    "How do you optimize React component rendering performance to prevent unnecessary re-renders?",
    "What is the event loop in JavaScript and how does it handle asynchronous tasks?",
    "How would you approach designing a state management system for a medium-sized application?",
  ],
  Senior: [
    "How do you architect scalable frontends for microservices or micro-frontends?",
    "Explain your strategy for implementing server-side rendering (SSR) vs static site generation (SSG).",
    "Describe a complex system design or technical challenge you solved, including architectural trade-offs.",
    "How do you handle security vulnerabilities such as XSS, CSRF, or sensitive data exposure on the frontend?",
    "How do you mentor junior developers and maintain high code quality standards across a growing team?",
  ],
  Lead: [
    "How do you balance technical debt against the business pressure of delivering new features rapidly?",
    "Describe your approach to designing a high-throughput, fault-tolerant microservice architecture.",
    "How do you align technical engineering strategies directly with company goals and business outcomes?",
    "Explain how you would lead a team through a major technology migration with zero system downtime.",
    "What is your philosophy on building and scaling high-performing cross-functional engineering teams?",
  ],
};

// API: Check status / health of Gemini connection
app.get("/api/status", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    status: "ok",
    hasGeminiKey: hasKey,
    mode: hasKey ? "live" : "demo_fallback",
  });
});

// API: Generate Questions
app.post("/api/generate-questions", async (req, res) => {
  const { jobDescription, experienceLevel, numQuestions } = req.body;
  const level = experienceLevel || "Mid";
  const num = numQuestions || 5;

  try {
    const ai = getGeminiClient();
    const prompt = `Generate a JSON array of ${num} interview questions for a ${level}-level role based on this Job Description:\n\n${jobDescription || "Software Engineer position requiring general coding, problem solving, and system design."}\n\nReturn ONLY a clean JSON array of strings, containing exactly ${num} questions. Make sure the questions are tailored to the role level and responsibilities.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite corporate technical recruiter and tech lead. You generate highly relevant, professional, challenging yet fair interview questions.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: `Array of exactly ${num} interview questions.`,
        },
      },
    });

    const text = response.text || "[]";
    const questions = JSON.parse(text);
    res.json({ questions });
  } catch (error: any) {
    console.warn("Gemini question generation error, using fallback questions:", error.message);
    // Use fallback based on experience level
    const baseList = FALLBACK_QUESTIONS[level] || FALLBACK_QUESTIONS["Mid"];
    const shuffled = [...baseList].sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, num);
    res.json({ questions, isDemoFallback: true, error: error.message });
  }
});

// API: Evaluate Candidate Answer
app.post("/api/evaluate-answer", async (req, res) => {
  const { question, answer, jobDescription, experienceLevel } = req.body;

  try {
    const ai = getGeminiClient();
    const prompt = `Evaluate this candidate's answer for an interview question.
Role Details: ${experienceLevel || "Mid"}-level position.
Job Description: ${jobDescription || "Software Engineering position"}

Question: "${question}"
Candidate's Answer: "${answer || "[No answer provided]"}"

Provide scores (0-100) for technical accuracy/proficiency, communication clarity, and candidate confidence (based on answer detail, structure, and depth). Include concise feedback and constructive suggestions. Return as a JSON object.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert technical interviewer. Be objective, realistic, and highly professional. Score candidate answers strictly but constructively.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            technicalScore: {
              type: Type.INTEGER,
              description: "Technical proficiency and correctness score out of 100.",
            },
            communicationScore: {
              type: Type.INTEGER,
              description: "Communication clarity, structure, and articulation score out of 100.",
            },
            confidenceScore: {
              type: Type.INTEGER,
              description: "Calculated confidence level of candidate based on completeness and tone, score out of 100.",
            },
            feedback: {
              type: Type.STRING,
              description: "A constructive, detailed critique of the answer.",
            },
            suggestions: {
              type: Type.STRING,
              description: "Actionable, precise tips on how the candidate can improve this specific answer.",
            },
          },
          required: ["technicalScore", "communicationScore", "confidenceScore", "feedback", "suggestions"],
        },
      },
    });

    const text = response.text || "{}";
    const evaluation = JSON.parse(text);
    res.json({ evaluation });
  } catch (error: any) {
    console.warn("Gemini evaluation error, using fallback review:", error.message);
    // Fallback simulation
    const technicalScore = answer ? Math.floor(Math.random() * 20) + 75 : 10;
    const communicationScore = answer ? Math.floor(Math.random() * 20) + 78 : 10;
    const confidenceScore = answer ? Math.floor(Math.random() * 20) + 72 : 10;

    res.json({
      evaluation: {
        technicalScore,
        communicationScore,
        confidenceScore,
        feedback: "Your answer touched on key aspects of the question. For a more comprehensive response, elaborate on specific architectural constraints, performance metrics, or team dynamics.",
        suggestions: "Structured frameworks like STAR (Situation, Task, Action, Result) will make your articulation even sharper. Use specific quantitative metrics where applicable.",
      },
      isDemoFallback: true,
      error: error.message,
    });
  }
});

// API: Generate Interview Summary
app.post("/api/generate-summary", async (req, res) => {
  const { rounds, jobDescription, experienceLevel } = req.body;

  try {
    const ai = getGeminiClient();
    const prompt = `Analyze this completed interview session containing multiple question-and-answer rounds.
Role: ${experienceLevel || "Mid"}-level position.
Job Description: ${jobDescription || "Software Engineering"}

Rounds:
${JSON.stringify(rounds, null, 2)}

Provide an aggregate analysis, including an Overall Score (0-100), key strengths (list of 2-3 points), opportunities/warnings for improvement (list of 2-3 points), and a progress trajectory (an array of exactly 4 numbers representing progressive score flow e.g., representing minutes 0, 15, 30, and 45 of the interview). Return as a JSON object.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the head of the corporate engineering hiring panel. Synthesize the candidate's full performance into an executive summary. Be fair, objective, and highlight actionable feedback.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: {
              type: Type.INTEGER,
              description: "Overall combined performance score out of 100.",
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2 or 3 bullet points detailing the candidate's strongest areas.",
            },
            opportunities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2 or 3 bullet points detailing the candidate's areas for growth.",
            },
            trajectory: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "An array of exactly 4 integers representing the progressive score trajectory over the interview (e.g. [78, 85, 82, 92]).",
            },
          },
          required: ["overallScore", "strengths", "opportunities", "trajectory"],
        },
      },
    });

    const text = response.text || "{}";
    const summary = JSON.parse(text);
    res.json({ summary });
  } catch (error: any) {
    console.warn("Gemini summary synthesis error, using fallback summary:", error.message);

    // Compute basic fallbacks from rounds
    let avgTech = 80;
    let avgComm = 82;
    let avgConf = 78;

    if (rounds && rounds.length > 0) {
      const validRounds = rounds.filter((r: any) => r.evaluation);
      if (validRounds.length > 0) {
        const sumTech = validRounds.reduce((acc: number, r: any) => acc + (r.evaluation.technicalScore || 80), 0);
        const sumComm = validRounds.reduce((acc: number, r: any) => acc + (r.evaluation.communicationScore || 80), 0);
        const sumConf = validRounds.reduce((acc: number, r: any) => acc + (r.evaluation.confidenceScore || 80), 0);
        avgTech = Math.round(sumTech / validRounds.length);
        avgComm = Math.round(sumComm / validRounds.length);
        avgConf = Math.round(sumConf / validRounds.length);
      }
    }

    const overallScore = Math.round((avgTech + avgComm + avgConf) / 3);

    res.json({
      summary: {
        overallScore,
        strengths: [
          "Strong structural breakdown of technical architecture and microservices problems.",
          "Excellent composure and active listening maintained throughout the stress-test questioning phase.",
        ],
        opportunities: [
          "Allocate less time to peripheral details and focus on concrete, high-level code or core logic implementation.",
          "Consider using precise tech metrics and KPIs to back up past architectural success stories.",
        ],
        trajectory: [overallScore - 6, overallScore + 2, overallScore - 2, overallScore + 5],
      },
      isDemoFallback: true,
      error: error.message,
    });
  }
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
