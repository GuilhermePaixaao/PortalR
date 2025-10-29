const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController'); // Importa o controller

// Define a rota POST para /
// (Ela vai virar /api/chat no index.js)
router.post('/', chatController.handleChat);

export default router;