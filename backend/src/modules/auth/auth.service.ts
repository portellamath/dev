import argon2 from "argon2";
import { prisma } from "../../shared/prisma";
import { generateRandomToken, hashToken } from "../../shared/token";
import { sendMail } from "../../shared/mailer";

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  // resposta genérica para evitar enumeração de e-mail
  const genericMessage = {
    message: "Se o email existir, você receberá instruções para redefinir a senha.",
  };

  if (!user) return genericMessage;

  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 min
    },
  });

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`;

  await sendMail(
    user.email,
    "Redefinição de senha",
    `
      <p>Olá${user.name ? `, ${user.name}` : ""}.</p>
      <p>Para redefinir sua senha, clique no link abaixo:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Esse link expira em 30 minutos.</p>
    `
  );

  return genericMessage;
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!resetToken) {
    throw new Error("Token inválido ou expirado.");
  }

  const passwordHash = await argon2.hash(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: {
        userId: resetToken.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
  ]);

  return { message: "Senha alterada com sucesso." };
}