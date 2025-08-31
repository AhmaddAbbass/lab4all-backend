// Ensure the correct path and file exist for signupHandler
export { signupHandler } from "./handlers/auth/signup";
export { loginHandler } from "./handlers/auth/login";
export { profileHandler } from "./handlers/auth/profile";
export { confirmHandler } from "./handlers/auth/confirm";

export { createClassroomHandler } from "./handlers/classroom/create";
export { joinClassroomHandler } from "./handlers/classroom/join";
export { getMyClassroomsHandler } from "./handlers/classroom/getClassrooms";
export { getMembersHandler } from "./handlers/classroom/getMembers";

export { deleteMembershipHandler } from "./handlers/classroom/leave";
export { kickStudentHandler } from "./handlers/classroom/kick";
export { registerSchoolHandler } from "./handlers/school/register";

export { listSchoolsHandler } from "./handlers/school/list";
export { getSchoolHandler } from "./handlers/school/get";

export { createAnnouncementHandler } from "./handlers/announcements/create";
export { fetchAnnouncementsHandler } from "./handlers/announcements/fetch";

export { createExperimentHandler } from "./handlers/experiments/create";
export { listExperimentsHandler } from "./handlers/experiments/list";
export { logExperimentHandler } from "./handlers/experiments/log";
export { deleteExperimentHandler } from "./handlers/experiments/delete";
export { getExperimentInfoHandler } from "./handlers/experiments/info";
export { toggleVisibilityExperimentHandler } from "./handlers/experiments/toggleVisibility";
export { finishExperimentHandler } from "./handlers/experiments/finish";
