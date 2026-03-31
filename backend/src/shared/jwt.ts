import jwt from "jsonwebtoken";

type AccessTokenPayload = {
  sub: string;
  role: "USER" | "ADMIN";
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: "15m",
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AccessTokenPayload;
}