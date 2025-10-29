// O seu server.js já carrega o 'dotenv/config',
// então não precisamos importar ele aqui. O process.env já vai funcionar.
import { OpenAI } from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Usa 'export default' para exportar o cliente
export default openai;

