require('dotenv').config({ path: '../../.env' }); // Sobe dois níveis para achar o .env
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = openai;