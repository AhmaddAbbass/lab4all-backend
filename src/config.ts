export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-later";
export const USERS_FILE = require("path").join(__dirname, "..", "data", "users.json");
