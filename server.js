import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
  botName: process.env.BOT_NAME || 'OFAS Bot',
  botAvatar: process.env.BOT_AVATAR || '🤖',
  userAvatar: process.env.USER_AVATAR || '🙂',
  title: process.env.APP_TITLE || 'OFAS Chat Assistant',
  welcomeMessage:
    process.env.WELCOME_MESSAGE ||
    '💖OFAS Bot สวัสดีค่า💖 OFAS Bot เป็นแชทบอทผู้ช่วยด้านการเงินของจุฬาฯ พร้อมให้ข้อมูลด้านการเงินค่ะ'
};

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (_req, res) => {
  res.json(CONFIG);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  try {
    const webhookUrl = String(process.env.N8N_WEBHOOK_URL || '').trim();
    const apiKey = String(process.env.N8N_API_KEY || '').trim();

    if (!webhookUrl || !apiKey) {
      return res.status(500).json({
        ok: false,
        answer: 'ยังไม่ได้ตั้งค่า N8N_WEBHOOK_URL หรือ N8N_API_KEY ใน Railway Variables'
      });
    }

    const message = String(req.body?.message || '').trim();
    const userId = String(req.body?.userId || '').trim();
    const sessionId = String(req.body?.sessionId || '').trim();
    const pageUrl = String(req.body?.pageUrl || '').trim();
    const origin = String(req.body?.origin || '').trim();

    if (!message) {
      return res.status(400).json({ ok: false, answer: 'กรุณาพิมพ์ข้อความก่อนส่ง' });
    }

    if (!userId || !sessionId) {
      return res.status(400).json({ ok: false, answer: 'ไม่พบข้อมูล session ของผู้ใช้' });
    }

    const reqBody = {
      message,
      userId,
      sessionId,
      pageUrl,
      origin,
      channel: 'web_railway',
      ts: new Date().toISOString()
    };

    let n8nResponse;
    try {
      n8nResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(reqBody)
      });
    } catch (_err) {
      return res.status(502).json({
        ok: false,
        answer: 'ขออภัย ระบบเชื่อมต่อ n8n ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      });
    }

    const text = await n8nResponse.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_err) {
      json = null;
    }

    const answer =
      (json && (json.answer || json.output || json.message)) ||
      text ||
      'ขออภัย ระบบยังไม่มีคำตอบ';

    if (n8nResponse.ok) {
      return res.json({ ok: true, answer });
    }

    return res.status(n8nResponse.status || 500).json({
      ok: false,
      answer: answer || 'ขออภัย ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง'
    });
  } catch (_err) {
    return res.status(500).json({
      ok: false,
      answer: 'ขออภัย ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OFAS chatbot is running on port ${PORT}`);
});
