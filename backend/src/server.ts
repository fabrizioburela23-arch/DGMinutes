import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { pool, initializeSchema } from './db';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'super-secret-key-for-dev');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
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
  await initializeSchema();

  const app = express();

  const allowedOrigins = CORS_ORIGIN === '*'
    ? true
    : CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

  app.use(cors({ origin: allowedOrigins, credentials: true }));
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
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      geminiConfigured: Boolean(GEMINI_API_KEY),
    });
  });

  app.get('/api/auth/master-count', async (_req, res) => {
    try {
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'master'");
      res.json({ count: result.rows[0].count });
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
        const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'master'");
        if (countResult.rows[0].count >= 3) {
          return res.status(400).json({ error: 'Maximum number of master accounts reached' });
        }
      }

      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR "interpreterId" = $2 LIMIT 1',
        [email, interpreterId],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        return res.status(400).json({ error: 'Email or Interpreter ID already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();

      await pool.query(
        `INSERT INTO users (id, "fullName", "interpreterId", platform, "primaryContact", "secondaryContact", email, password, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          fullName,
          interpreterId,
          platform,
          primaryContact,
          secondaryContact || '',
          email,
          hashedPassword,
          normalizedRole,
        ],
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

      const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
      const user = result.rows[0];
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

  app.get('/api/auth/me', authenticate, async (req: any, res) => {
    try {
      const result = await pool.query(
        `SELECT id, "fullName", "interpreterId", platform, "primaryContact", "secondaryContact", email, role
         FROM users WHERE id = $1 LIMIT 1`,
        [req.user.id],
      );
      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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

  app.post('/api/records', authenticate, async (req: any, res) => {
    try {
      const { interpreterId, dateRange, totalMinutes, totalCalls, recordType } = req.body;

      if (!interpreterId || !dateRange || !Number.isFinite(Number(totalMinutes)) || !Number.isFinite(Number(totalCalls))) {
        return res.status(400).json({ error: 'Invalid record payload' });
      }

      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO daily_records (id, "userId", "interpreterId", username, "dateRange", "totalMinutes", "totalCalls", "recordType")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          req.user.id,
          interpreterId,
          req.user.fullName,
          dateRange,
          Number(totalMinutes),
          Number(totalCalls),
          recordType || 'daily',
        ],
      );

      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/records', authenticate, async (req: any, res) => {
    try {
      const result = req.user.role === 'master'
        ? await pool.query('SELECT * FROM daily_records ORDER BY "createdAt" DESC')
        : await pool.query('SELECT * FROM daily_records WHERE "userId" = $1 ORDER BY "createdAt" DESC', [req.user.id]);

      res.json({ records: result.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/users', authenticate, requireMaster, async (_req: any, res) => {
    try {
      const result = await pool.query(
        `SELECT id, "fullName", "interpreterId", platform, "primaryContact", "secondaryContact", email, role
         FROM users ORDER BY "fullName" ASC`,
      );
      res.json({ users: result.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
