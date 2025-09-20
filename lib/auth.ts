import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from './mongodb';
import { ObjectId } from 'mongodb';

if (!process.env.JWT_SECRET) {
  throw new Error('Please add your JWT_SECRET to .env.local');
}

const JWT_SECRET = process.env.JWT_SECRET;
// const JWT_SECRET = "your-super-secret-jwt-key-here-make-it-long-and-random";
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  isVerified: boolean;
  isCreator: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch {
    return null;
  }
}

export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const db = await getDatabase();
  const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.id) });
  
  if (!user) return null;

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    isVerified: user.isVerified || false,
    isCreator: user.isCreator || false,
  };
}

export function getAuthHeader(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}