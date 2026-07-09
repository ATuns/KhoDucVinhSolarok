import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    photoUrl?: string;
    dbId: number; // The database primary key user id
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  
  // Use static token instead of Firebase for this app version
  if (token !== 'DucVinh@123') {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  
  try {
    const uid = 'admin';
    const email = 'admin@ducvinh.com';
    const name = 'Admin';
    const photoUrl = '';

    // Synchronize user to PostgreSQL database
    // Using Drizzle upsert with retry mechanism for scale-to-zero connection drops
    let result;
    let retries = 5;
    while (retries > 0) {
      try {
        result = await db.insert(users)
          .values({
            uid,
            email,
            name,
            photoUrl,
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: {
              email,
              name,
              photoUrl,
            },
          })
          .returning();
        break; // Success
      } catch (err: any) {
        retries--;
        const errString = (err.message || '') + ' ' + (err.cause?.message || '') + ' ' + JSON.stringify(err);
        const isConnectionError = errString.includes('Connection terminated') || 
                                  errString.includes('starting up') || 
                                  errString.includes('recovery') || 
                                  errString.includes('ECONNRESET') ||
                                  errString.includes('terminating connection');
        
        if (retries === 0 || !isConnectionError) {
          throw err;
        }
        console.warn(`DB connection dropped/starting, retrying... (${5 - retries}/5)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!result || result.length === 0) {
      throw new Error("Failed to insert/update user");
    }

    const dbUser = result[0];

    req.user = {
      uid,
      email,
      name,
      photoUrl,
      dbId: dbUser.id,
    };

    next();
  } catch (error) {
    console.error('Error in auth middleware:', error);
    return res.status(401).json({ error: 'Unauthorized: Server error' });
  }
};
