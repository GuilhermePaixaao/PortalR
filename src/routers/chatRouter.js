// src/routers/chatRouter.js
import express from 'express';
import { handleChat } from '../controllers/chatController.js';

const router = express.Router();

router.post('/', handleChat); // A rota é '/'

export default router;