import { Request, Response } from "express";
import { requestPasswordReset, resetPassword } from "./auth.service";

export async function forgotPasswordController(req: Request, res: Response) {
  try {
    const { email } = req.body;
    const result = await requestPasswordReset(email);
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ message: "Erro ao solicitar redefinição." });
  }
}

export async function resetPasswordController(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token e nova senha são obrigatórios." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "A senha deve ter no mínimo 8 caracteres." });
    }

    const result = await resetPassword(token, newPassword);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Erro ao redefinir senha.",
    });
  }
}