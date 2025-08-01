// Ensure the correct path and file exist for signupHandler
// auth functions
export { signupHandler } from './handlers/auth/signup';
export { loginHandler }  from './handlers/auth/login';
export { profileHandler } from './handlers/auth/profile';
export { confirmHandler } from './handlers/auth/confirm';

// classroom functions 
export { createClassroomHandler } from './handlers/classroom/create';
export { joinClassroomHandler } from './handlers/classroom/join';
export { getClassroomsHandler } from './handlers/classroom/getClassrooms';
export { getMembersHandler } from './handlers/classroom/getMembers';