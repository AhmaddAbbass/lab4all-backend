export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: "student" | "instructor";
  createdAt: string;
}
export interface Classroom {
  classroomId: string;
  name: string;
  joinCode: string;
  teacherId: string;
  createdAt: string;
}
export interface Membership {
  studentId: string;
  classroomId: string;
  joinedAt: string;
}
