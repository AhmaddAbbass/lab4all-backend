import express from "express";
import authRoutes from "./routes/auth";
import classroomsRoutes from "./routes/classrooms";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
app.use("/classrooms", classroomsRoutes);