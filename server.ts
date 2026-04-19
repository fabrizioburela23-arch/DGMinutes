import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'app.db');
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'super-secret-key-for-dev');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
}

const databaseDirectory = path.dirname(DATABASE_PATH);
if (databaseDirectory && databaseDirectory !== '.') {
  fs.mkdirSync(databaseDirectory, { recursive: true });
}

const db = new Database(DATABASE_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    fullName TEXT NOT NULL,
    interpreterId TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    primaryContact TEXT NOT NULL,
    secondaryContact TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_records (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    interpreterId TEXT NOT NULL,
    username TEXT NOT NULL,
    dateRange TEXT NOT NULL,
    totalMinutes INTEGER NOT NULL,
    totalCalls INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

try {
  db.exec(`ALTER TABLE daily_records ADD COLUMN recordType TEXT DEFAULT 'daily'`);
} catch {
  // Column already exists.
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function createAiClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

function parseGeneratedJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  return JSON.parse(cleaned || '{}');
}

function toSafeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toSafeNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid token provided' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'No valid token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const requireMaster = (req: any, res: any, next: any) => {
    if (req.user.role !== 'master') {
      return res.status(403).json({ error: 'Forbidden: Master role required' });
    }
    next();
  };

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      environment: isProduction ? 'production' : 'development',
      databasePath: DATABASE_PATH,
      geminiConfigured: Boolean(GEMINI_API_KEY),
    });
  });

  app.get('/api/auth/master-count', (_req, res) => {
    try {
      const countResult: any = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'master'").get();
      res.json({ count: countResult.count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const {
        fullName,
        interpreterId,
        platform,
        primaryContact,
        secondaryContact,
        email,
        password,
        role,
      } = req.body;

      const normalizedRole = role === 'master' ? 'master' : 'interpreter';

      if (!fullName || !interpreterId || !platform || !primaryContact || !email || !password) {
        return res.status(400).json({ error: 'Missing required registration fields' });
      }

      if (normalizedRole === 'master') {
        const countResult: any = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'master'").get();
        if (countResult.count >= 3) {
          return res.status(400).json({ error: 'Maximum number of master accounts reached' });
        }
      }

      const existingUser = db.prepare('SELECT * FROM users WHERE email = ? OR interpreterId = ?').get(email, interpreterId);
      if (existingUser) {
        return res.status(400).json({ error: 'Email or Interpreter ID already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();

      db.prepare(`
        INSERT INTO users (id, fullName, interpreterId, platform, primaryContact, secondaryContact, email, password, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        fullName,
        interpreterId,
        platform,
        primaryContact,
        secondaryContact || '',
        email,
        hashedPassword,
        normalizedRole,
      );

      const token = jwt.sign(
        { id, email, role: normalizedRole, fullName, interpreterId },
        JWT_SECRET,
        { expiresIn: '24h' },
      );

      res.json({ token, user: { id, email, role: normalizedRole, fullName, interpreterId } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          interpreterId: user.interpreterId,
        },
        JWT_SECRET,
        { expiresIn: '24h' },
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          interpreterId: user.interpreterId,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/me', authenticate, (req: any, res) => {
    const user: any = db
      .prepare('SELECT id, fullName, interpreterId, platform, primaryContact, secondaryContact, email, role FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  });

  app.post('/api/analyze-image', authenticate, upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file was uploaded' });
      }

      const looksLikeImage = req.file.mimetype?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(req.file.originalname || '');
      if (!looksLikeImage) {
        return res.status(400).json({ error: 'Only image files are allowed' });
      }

      const ai = createAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              text: [
                'Analyze this screenshot of an interpreter dashboard or report.',
                'Extract the following fields and return valid JSON only:',
                '- interpreterId: string',
                '- dateRange: string',
                '- totalMinutes: number',
                '- totalCalls: number',
                'If a field is not visible, return an empty string for text fields or 0 for numeric fields.',
              ].join('\n'),
            },
            {
              inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype,
              },
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              interpreterId: { type: Type.STRING },
              dateRange: { type: Type.STRING },
              totalMinutes: { type: Type.NUMBER },
              totalCalls: { type: Type.NUMBER },
            },
          },
        },
      });

      const data = parseGeneratedJson(response.text || '{}');
      res.json({
        data: {
          interpreterId: toSafeString(data.interpreterId),
          dateRange: toSafeString(data.dateRange),
          totalMinutes: toSafeNumber(data.totalMinutes),
          totalCalls: toSafeNumber(data.totalCalls),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Image analysis failed' });
    }
  });

  app.post('/api/records', authenticate, (req: any, res) => {
    try {
      const { interpreterId, dateRange, totalMinutes, totalCalls, recordType } = req.body;

      if (!interpreterId || !dateRange || !Number.isFinite(Number(totalMinutes)) || !Number.isFinite(Number(totalCalls))) {
        return res.status(400).json({ error: 'Invalid record payload' });
      }

      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO daily_records (id, userId, interpreterId, username, dateRange, totalMinutes, totalCalls, recordType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.user.id,
        interpreterId,
        req.user.fullName,
        dateRange,
        Number(totalMinutes),
        Number(totalCalls),
        recordType || 'daily',
      );

      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/records', authenticate, (req: any, res) => {
    try {
      const records = req.user.role === 'master'
        ? db.prepare('SELECT * FROM daily_records ORDER BY createdAt DESC').all()
        : db.prepare('SELECT * FROM daily_records WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);

      res.json({ records });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/users', authenticate, requireMaster, (_req: any, res) => {
    try {
      const users = db
        .prepare('SELECT id, fullName, interpreterId, platform, primaryContact, secondaryContact, email, role FROM users ORDER BY fullName ASC')
        .all();
      res.json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
