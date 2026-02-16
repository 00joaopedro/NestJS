// src/types/express.d.ts
import * as express from 'express';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: number;
        username: string;
        roles: string[];
        name?: string;
        // adicione outros campos conforme seu payload
      };
    }
  }
}

// Para garantir que esse arquivo seja tratado como módulo
export {};