declare global {
  namespace Express {
    interface Request { user?: { id: string; email: string; sessionId?:string }; }
  }
}
export {};
