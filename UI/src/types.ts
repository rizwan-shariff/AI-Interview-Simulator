/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InterviewConfig {
  jobDescription: string;
  experienceLevel: 'Junior' | 'Mid' | 'Senior' | 'Lead';
  numQuestions: number;
}

export interface Question {
  id: number;
  text: string;
}

export interface Evaluation {
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  feedback: string;
  suggestions: string;
}

export interface InterviewRound {
  questionId: number;
  questionText: string;
  answerText: string;
  evaluation?: Evaluation;
}

export interface Session {
  id: string;
  date: string;
  config: InterviewConfig;
  rounds: InterviewRound[];
  overallScore?: number;
  keyTakeaways?: {
    strengths: string[];
    opportunities: string[];
  };
  trajectory?: number[]; // list of scores representing progressive performance
  completed: boolean;
  durationSeconds: number;
  bodyLanguageScore?: number;
  bodyLanguageFeedback?: string;
}
