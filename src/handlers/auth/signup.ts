import { APIGatewayProxyHandler } from 'aws-lambda';
import AWS from 'aws-sdk';
import { z } from 'zod';

const cognito = new AWS.CognitoIdentityServiceProvider();

const bodySchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  firstName: z.string().nonempty(),
  lastName:  z.string().nonempty(),
  school:    z.string().nonempty(),
  role:      z.enum(['student', 'instructor']),
  grade:     z.string().nonempty(),
});

export const signupHandler: APIGatewayProxyHandler = async (event) => {
  // bodySchema.safeParse  will check if the body match the expected schema haha
    // console.log('EVENT:', JSON.stringify(event, null, 2));

  const parsed = bodySchema.safeParse(JSON.parse(event.body || '{}'));
  // console.log('PARSED:', JSON.stringify(parsed, null, 2));
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_INPUT',
        details: parsed.error.format(),
      }),
    };
  }


  const { email, password, firstName, lastName, school, role, grade } = parsed.data;

  try {
    // call Cognito to sign up the user
    await cognito.signUp({
      ClientId: process.env.CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email',         Value: email },
        { Name: 'given_name',    Value: firstName },
        { Name: 'family_name',   Value: lastName },
        { Name: 'custom:school', Value: school },
        { Name: 'custom:role',   Value: role },
        { Name: 'custom:grade',  Value: grade },
      ],
    }).promise();


    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Signup successful' }),
    };
  } catch (err: any) {
    // console.error('Signup error:', err);
    // Handling specific Cognito errors is needed here 
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: err.message || 'Signup failed',
      }),
    };
  }
};
