import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  wahaUrl: process.env.WAHA_URL || 'http://localhost:3000/api/sendMessage',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};