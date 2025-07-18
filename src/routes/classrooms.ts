import { Router } from "express";
import { z } from "zod";
import { authUser } from "../middleware/authUser";
import { classroomRepo } from "../repos/classroomRepo";
import { membershipRepo } from "../repos/membershipRepo";

const router = Router();

// All classroom routes require auth
router.use(authUser);

/**
 * Create Classroom (Instructor only)
 */
const createSchema = z.object({
  name: z.string().min(3)
});

router.post("/", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "NO_USER" });
  if (req.user.role !== "instructor") {
    return res.status(403).json({ error: "FORBIDDEN_ROLE" });
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.format() });
  }

  const classroom = classroomRepo.create(parsed.data.name, req.user.userId);
  return res.status(201).json({
    classroomId: classroom.classroomId,
    name: classroom.name,
    joinCode: classroom.joinCode,
    createdAt: classroom.createdAt
  });
});

/**
 * Join Classroom (Student only)
 */
const joinSchema = z.object({
  code: z.string().length(6)
});

router.post("/join", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "NO_USER" });
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "FORBIDDEN_ROLE" });
  }

  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.format() });
  }

  const code = parsed.data.code.toUpperCase();
  const classroom = classroomRepo.findByJoinCode(code);
  if (!classroom) {
    return res.status(404).json({ error: "INVALID_CODE" });
  }

  const existing = membershipRepo.find(req.user.userId, classroom.classroomId);
  let membership;
  let alreadyMember = false;

  if (existing) {
    membership = existing;
    alreadyMember = true;
  } else {
    membership = membershipRepo.create(req.user.userId, classroom.classroomId);
  }

  return res.json({
    classroomId: classroom.classroomId,
    name: classroom.name,
    joinedAt: membership.joinedAt,
    alreadyMember
  });
});

/**
 * List My Classrooms
 * - Student: classrooms joined (with joinedAt)
 * - Instructor: classrooms created
 */
router.get("/mine", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "NO_USER" });

  if (req.user.role === "student") {
    const memberships = membershipRepo.listByStudent(req.user.userId);
    const classIds = memberships.map(m => m.classroomId);
    const classes = classroomRepo.listByIds(classIds);

    // Build a map for quick joinedAt lookup
    const joinedAtMap = new Map<string, string>(
      memberships.map(m => [m.classroomId, m.joinedAt])
    );

    const result = classes.map(c => ({
      classroomId: c.classroomId,
      name: c.name,
      teacherId: c.teacherId,
      joinedAt: joinedAtMap.get(c.classroomId)
    }));

    // (Optional) sort by joinedAt desc
    result.sort((a, b) => (a.joinedAt! < b.joinedAt! ? 1 : -1));

    return res.json(result);
  }

  if (req.user.role === "instructor") {
    const classes = classroomRepo.listByTeacher(req.user.userId);
    // Optional: sort by createdAt desc
    classes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const result = classes.map(c => ({
      classroomId: c.classroomId,
      name: c.name,
      joinCode: c.joinCode,
      createdAt: c.createdAt
    }));
    return res.json(result);
  }

  return res.status(403).json({ error: "FORBIDDEN_ROLE" });
});
export default router;
