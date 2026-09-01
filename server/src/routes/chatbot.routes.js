import { Router } from 'express';
import { getChatbotConfig } from '../services/settings.js';
import { handleChatbotMessage } from '../utils/chatbot.js';

export default function chatbotRoutes() {
  const router = Router();

  router.post('/message', async (req, res, next) => {
    try {
      const { text, role } = req.body || {};
      const config = await getChatbotConfig();
      if (!config.enabled) {
        return res.json({ reply: 'The assistant is currently turned off.', quickReplies: [] });
      }
      if (!text || !String(text).trim()) {
        return res.json({ reply: 'Please type a question 🙂 — e.g. "fare for 5 km" or "how to book".', quickReplies: config.quickReplies || [] });
      }
      const result = await handleChatbotMessage(String(text), role || 'rider', config);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}