import AWS from 'aws-sdk';

const cognito = new AWS.CognitoIdentityServiceProvider();

const USER_POOL_ID = process.env.USER_POOL_ID as string; // ensure this is in .env

interface StudentInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  school: string;
  grade: string;
  role: string;
}

export const fetchStudentInfo = async (studentId: string): Promise<StudentInfo | null> => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: studentId,
  };

  try {
    const data = await cognito.adminGetUser(params).promise();

    const attrs = data.UserAttributes?.reduce((acc, attr) => {
    if (attr.Name && attr.Value) {
        acc[attr.Name] = attr.Value;
    }
    return acc;
    }, {} as Record<string, string>);

    if (!attrs) return null;

    return {
      id: studentId,
      email: attrs['email'] || '',
      firstName: attrs['given_name'] || '',
      lastName: attrs['family_name'] || '',
      school: attrs['custom:school'] || '',
      grade: attrs['custom:grade'] || '',
      role: attrs['custom:role'] || '',
    };
  } catch (err) {
    console.error(`Error fetching user ${studentId}:`, err);
    return null;
  }
};
