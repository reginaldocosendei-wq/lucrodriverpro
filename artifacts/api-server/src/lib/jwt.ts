import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "lucro-driver-jwt-dev-secret-change-in-prod";
const JWT_EXPIRES = "30d";

export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    if (typeof payload.userId !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}
