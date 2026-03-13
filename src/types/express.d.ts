declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      email: string | null;
      roles: string[];
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
