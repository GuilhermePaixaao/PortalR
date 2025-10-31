// config/openai.js

// O seu server.js já deve carregar o 'dotenv',
// então 'process.env' já estará disponível aqui.
import { OpenAI } from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Usa 'export default' para exportar o cliente
export default openai;