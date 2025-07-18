import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { User } from "../models";

export function signUser(user: User) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}
