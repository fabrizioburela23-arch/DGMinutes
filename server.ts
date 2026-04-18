import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Initialize DB
const db = new Database('app.db');

// Create tables
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
} catch (e) {
  // Ignore if column already exists
}

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const requireMaster = (req: any, res: any, next: any) => {
    if (req.user.role !== 'master') {
      return res.status(403).json({ error: 'Forbidden: Master role required' });
    }
    next();
  };

  // Check master count
  app.get('/api/auth/master-count', (req, res) => {
    try {
      const countResult: any = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'master'").get();
      res.json({ count: countResult.count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { fullName, interpreterId, platform, primaryContact, secondaryContact, email, password, role } = req.body;
      
      if (role === 'master') {
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

      const stmt = db.prepare(`
        INSERT INTO users (id, fullName, interpreterId, platform, primaryContact, secondaryContact, email, password, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, fullName, interpreterId, platform, primaryContact, secondaryContact, email, hashedPassword, role || 'interpreter');

      const token = jwt.sign({ id, email, role: role || 'interpreter', fullName, interpreterId }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id, email, role: role || 'interpreter', fullName, interpreterId } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, fullName: user.fullName, interpreterId: user.interpreterId }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName, interpreterId: user.interpreterId } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get current user
  app.get('/api/auth/me', authenticate, (req: any, res) => {
    const user: any = db.prepare('SELECT id, fullName, interpreterId, platform, primaryContact, secondaryContact, email, role FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  });

  // Submit Record
  app.post('/api/records', authenticate, (req: any, res) => {
    try {
      const { interpreterId, dateRange, totalMinutes, totalCalls, recordType } = req.body;
      const id = crypto.randomUUID();
      
      const stmt = db.prepare(`
        INSERT INTO daily_records (id, userId, interpreterId, username, dateRange, totalMinutes, totalCalls, recordType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, req.user.id, interpreterId, req.user.fullName, dateRange, totalMinutes, totalCalls, recordType || 'daily');
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Records (Interpreter sees own, Master sees all)
  app.get('/api/records', authenticate, (req: any, res) => {
    try {
      let records;
      if (req.user.role === 'master') {
        records = db.prepare('SELECT * FROM daily_records ORDER BY createdAt DESC').all();
      } else {
        records = db.prepare('SELECT * FROM daily_records WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);
      }
      res.json({ records });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Users (Master only)
  app.get('/api/users', authenticate, requireMaster, (req: any, res) => {
    try {
      const users = db.prepare('SELECT id, fullName, interpreterId, platform, primaryContact, secondaryContact, email, role FROM users ORDER BY fullName ASC').all();
      res.json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
