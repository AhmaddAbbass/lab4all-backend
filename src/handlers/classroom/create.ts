// src/handlers/classroom/create.ts
import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { ClassroomSchema } from "../../schemas/classroom";
import { insertClassroomRecord } from "../../utils/database/classrooms/insertClassroom";
import { generateJoinCode } from "../../utils/other/generateJoinCode";
import { getSchoolById } from "../../utils/database/schools/getSchoolById";
import { putMembershipBothWays } from "../../utils/database/memberships/putMembershipBothWays";
/*
createClassroomHandler

Handler for POST /classroom/create.
Instructors use this endpoint to create a new classroom and become its first member.

Flow:
- Validate Cognito claims → must be authenticated instructor.
- Parse request body for classroomName.
- Resolve schoolId from user claims and fetch school record (do not trust body).
- Build classroom record with uuid, joinCode, teacher info, timestamps.
- Validate record against ClassroomSchema.
- Insert classroom into DynamoDB.
- Create bi-directional membership edges (instructor ↔ classroom).
- Return 201 with classroomID and joinCode.

Error codes:
- 400 → invalid JSON, validation failed, missing/invalid school
- 401 → unauthorized (no claims)
- 403 → not an instructor
- 500 → failed to insert classroom
*/

export const createClassroomHandler: APIGatewayProxyHandler = async (event) => {
  // Auth & role check
  const claims = (event.requestContext.authorizer as any)?.claims;
  if (!claims) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  if (claims["custom:role"] !== "instructor") {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Only teachers can create classrooms" }),
    };
  }

  // Parse request body
  let body: any = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  // Resolve school from claims (canonical) and hydrate name server-side
  const schoolId = claims["custom:schoolId"];
  if (!schoolId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "MISSING_SCHOOL_ID_ON_ACCOUNT" }),
    };
  }
  const school = await getSchoolById(schoolId);
  if (!school) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "SCHOOL_NOT_FOUND" }),
    };
  }

  // Build classroom item
  const joinCode = generateJoinCode(); // generate ONCE and reuse
  const classroomRecord = {
    classroomID: uuidv4(),
    classroomName: String(body.classroomName || "").trim(),
    schoolId: school.schoolId,
    school: school.name, // do NOT trust body for name
    createdAt: new Date().toISOString(),
    teacherId: claims.sub,
    teacherName:
      [claims["given_name"], claims["family_name"]].filter(Boolean).join(" ") ||
      claims.email,
    joinCode,
  };

  // Validate payload against schema
  const validation = ClassroomSchema.safeParse(classroomRecord);
  if (!validation.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Validation failed",
        details: validation.error.format(),
      }),
    };
  }

  // Write classroom, then membership edges atomically
  try {
    await insertClassroomRecord(validation.data);

    await putMembershipBothWays({
      userId: validation.data.teacherId,
      classroomId: validation.data.classroomID,
      role: "instructor",
      joinedAt: validation.data.createdAt,
    });

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Classroom created",
        classroomID: validation.data.classroomID,
        joinCode, // same one stored
      }),
    };
  } catch (err) {
    console.error("createClassroom error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to insert classroom" }),
    };
  }
};
