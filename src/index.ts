// Ensure the correct path and file exist for signupHandler
// auth functions
export { signupHandler } from './handlers/auth/signup';
export { loginHandler }  from './handlers/auth/login';
export { profileHandler } from './handlers/auth/profile';
export { confirmHandler } from './handlers/auth/confirm';

// classroom functions 
export { createClassroomHandler } from './handlers/classroom/create';
export { joinClassroomHandler } from './handlers/classroom/join';
export { getMyClassroomsHandler } from './handlers/classroom/getClassrooms';
export { getMembersHandler } from './handlers/classroom/getMembers';

// NEW
export { deleteMembershipHandler } from './handlers/classroom/leave';
export { kickStudentHandler } from './handlers/classroom/kick';
export { registerSchoolHandler } from './handlers/school/register';

export { listSchoolsHandler } from './handlers/school/list';
export { getSchoolHandler }  from './handlers/school/get';

export { createAnnouncementHandler } from './handlers/announcements/create';
export { fetchAnnouncementsHandler } from "./handlers/announcements/fetch";