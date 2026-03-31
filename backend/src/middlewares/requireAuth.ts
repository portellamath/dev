import { Request, Response, NextFunction } from "express";
import { prisma } from "../shared/prisma";
import { verifyAccessToken } from "../shared/jwt";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente." });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Usuário inválido ou inativo." });
    }

    req.user = {
      id: user.id,
      role: user.role,
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
}