// src/config/openai.js
import { OpenAI } from 'openai';

// Configura a instância global para usar a Groq
const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, // Certifique-se de ter essa variável no Railway/.env
    baseURL: "https://api.groq.com/openai/v1"
});

export default openai;