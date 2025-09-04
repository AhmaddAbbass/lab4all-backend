import { APIGatewayProxyHandler } from "aws-lambda";
import { dobClient } from "../../utils/database/dynamo";
import { toSlug } from "../../utils/other/toSlug";
import {
  queryByCountryCity,
  searchByName,
} from "../../utils/database/schools/fetchSchools";
import { DEFAULT_HEADERS } from "../../utils/headers/defaults";

/*
listSchoolsHandler

Handler for GET /schools.  
Provides flexible search and browse functionality for the schools directory.

Supported query modes:
0) No params → global alphabetical list (via globalName-index).
1) q only → global typeahead search by name (via globalName-index).
2) countryCode only → list schools in a country alphabetically (via countryName-index).
3) countryCode + q → search schools by name within a country (delegates to searchByName util).
4) countryCode + city → browse schools in a city (delegates to queryByCountryCity util).
5) city without countryCode → invalid (ambiguous).

Flow:
- Extract query string params: q, countryCode, city, limit, nextToken.
- Branch logic into one of the modes above.
- Execute DynamoDB query or util call accordingly.
- Shape items into { schoolId, name, countryCode, city }.
- Support pagination with nextToken (LastEvaluatedKey).

Error codes:
- 400 → missing/ambiguous params (e.g., city without countryCode).
- 500 → DynamoDB/internal error.

Notes:
- Uses multiple GSIs (globalName-index, countryName-index, countryCityName-index).
- Limit is capped at 100 per request.
- NextToken is serialized JSON of DynamoDB LastEvaluatedKey.
*/

const map = (x: any) => ({
  schoolId: x.schoolId,
  name: x.name,
  countryCode: x.countryCode,
  city: x.city,
});

export const listSchoolsHandler: APIGatewayProxyHandler = async (event) => {
  const qs = event.queryStringParameters || {};
  const q = (qs.q || "").trim();
  const countryCode = (qs.countryCode || "").trim();
  const city = (qs.city || "").trim();
  const limit = Math.min(parseInt(qs.limit || "25", 10) || 25, 100);
  const nextToken = qs.nextToken;

  try {
    // 0) No params: global alphabetical list (via globalName-index)
    if (!q && !countryCode && !city) {
      const res = await dobClient
        .query({
          TableName: process.env.SCHOOLS_TABLE!,
          IndexName: "globalName-index",
          KeyConditionExpression: "#g = :g",
          ExpressionAttributeNames: { "#g": "gpk" },
          ExpressionAttributeValues: { ":g": "SCHOOL" },
          Limit: limit,
          ExclusiveStartKey: nextToken ? JSON.parse(nextToken) : undefined,
          ScanIndexForward: true, // ascending by nameSlug
        })
        .promise();

      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({
          schools: (res.Items || []).map(map),
          nextToken: res.LastEvaluatedKey
            ? JSON.stringify(res.LastEvaluatedKey)
            : null,
        }),
      };
    }

    // 1) Global name search (q only) via globalName-index
    if (q && !countryCode && !city) {
      const res = await dobClient
        .query({
          TableName: process.env.SCHOOLS_TABLE!,
          IndexName: "globalName-index",
          KeyConditionExpression: "#g = :g AND begins_with(#n, :p)",
          ExpressionAttributeNames: { "#g": "gpk", "#n": "nameSlug" },
          ExpressionAttributeValues: { ":g": "SCHOOL", ":p": toSlug(q) },
          Limit: limit,
          ExclusiveStartKey: nextToken ? JSON.parse(nextToken) : undefined,
          ScanIndexForward: true,
        })
        .promise();

      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({
          schools: (res.Items || []).map(map),
          nextToken: res.LastEvaluatedKey
            ? JSON.stringify(res.LastEvaluatedKey)
            : null,
        }),
      };
    }

    // 2) Country-only list (all schools in a country, alphabetical)
    if (!q && countryCode && !city) {
      const res = await dobClient
        .query({
          TableName: process.env.SCHOOLS_TABLE!,
          IndexName: "countryName-index",
          KeyConditionExpression: "#cc = :cc",
          ExpressionAttributeNames: { "#cc": "countryCode" },
          ExpressionAttributeValues: { ":cc": countryCode.toUpperCase() },
          Limit: limit,
          ExclusiveStartKey: nextToken ? JSON.parse(nextToken) : undefined,
          ScanIndexForward: true,
        })
        .promise();

      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({
          schools: (res.Items || []).map(map),
          nextToken: res.LastEvaluatedKey
            ? JSON.stringify(res.LastEvaluatedKey)
            : null,
        }),
      };
    }

    // 3) Country + q (typeahead within a country)
    if (q && countryCode) {
      const { items, nextToken: nt } = await searchByName(
        countryCode,
        q,
        limit,
        nextToken
      );
      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({
          schools: items.map(map),
          nextToken: nt || null,
        }),
      };
    }

    // 4) Country + city (browse within a city)
    if (countryCode && city) {
      const { items, nextToken: nt } = await queryByCountryCity(
        countryCode,
        city,
        limit,
        nextToken
      );
      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS,

        body: JSON.stringify({
          schools: items.map(map),
          nextToken: nt || null,
        }),
      };
    }

    // 5) City without country is ambiguous (different countries have same city names)
    return {
      statusCode: 400,
      headers: DEFAULT_HEADERS,

      body: JSON.stringify({
        error: "MISSING_PARAMS",
        hint: "Provide (q), or (countryCode), or (countryCode & city). City requires countryCode.",
      }),
    };
  } catch (err: any) {
    console.error("listSchools error:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,

      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
