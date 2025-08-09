// src/utils/database/fetchSchools.ts
import { dobClient } from './dynamo';
import { toSlug } from '../other/toSlug';
import { getSchoolById } from './getSchoolById';

type NextToken = string | undefined;

interface ListResult<T> {
  items: T[];
  nextToken?: NextToken;
}

/**
 * Browse schools by country+city (alphabetical by name).
 * Backed by GSI: countryCityName-index
 *   - PK:  ccCity   = "<COUNTRY_CODE>#<citySlug>"
 *   - SK:  nameSlug
 */
export const queryByCountryCity = async <T = any>(
  countryCode: string,
  city: string,
  limit = 25,
  nextToken?: NextToken
): Promise<ListResult<T>> => {
  const cc = countryCode.toUpperCase();
  const citySlug = toSlug(city);
  const ccCity = `${cc}#${citySlug}`;

  const res = await dobClient.query({
    TableName: process.env.SCHOOLS_TABLE!,
    IndexName: 'countryCityName-index',
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': 'ccCity' },
    ExpressionAttributeValues: { ':pk': ccCity },
    Limit: limit,
    ExclusiveStartKey: nextToken ? JSON.parse(nextToken) : undefined,
  }).promise();

  return {
    items: (res.Items as T[]) ?? [],
    nextToken: res.LastEvaluatedKey ? JSON.stringify(res.LastEvaluatedKey) : undefined,
  };
};

/**
 * Typeahead search by name within a country.
 * Backed by GSI: countryName-index
 *   - PK: countryCode
 *   - SK: nameSlug (use begins_with)
 */
export const searchByName = async <T = any>(
  countryCode: string,
  namePrefix: string,
  limit = 25,
  nextToken?: NextToken
): Promise<ListResult<T>> => {
  const cc = countryCode.toUpperCase();
  const prefix = toSlug(namePrefix);

  const res = await dobClient.query({
    TableName: process.env.SCHOOLS_TABLE!,
    IndexName: 'countryName-index',
    KeyConditionExpression: '#cc = :cc AND begins_with(#nameSlug, :prefix)',
    ExpressionAttributeNames: {
      '#cc': 'countryCode',
      '#nameSlug': 'nameSlug',
    },
    ExpressionAttributeValues: {
      ':cc': cc,
      ':prefix': prefix,
    },
    Limit: limit,
    ExclusiveStartKey: nextToken ? JSON.parse(nextToken) : undefined,
  }).promise();

  return {
    items: (res.Items as T[]) ?? [],
    nextToken: res.LastEvaluatedKey ? JSON.stringify(res.LastEvaluatedKey) : undefined,
  };
};

/**
 * Resolve a school from either:
 *  - schoolId, or
 *  - schoolName (+ optional countryCode/city)
 *
 * Returns { school, reason? }, where reason ∈ {'NOT_FOUND'|'AMBIGUOUS'} when school is null.
 */
export const resolveSchool = async (opts: {
  schoolId?: string;
  schoolName?: string;
  countryCode?: string;
  city?: string;
}): Promise<{ school: any | null; reason?: 'NOT_FOUND' | 'AMBIGUOUS' }> => {
  const { schoolId, schoolName, countryCode, city } = opts;

  // 1) Direct ID lookup
  if (schoolId) {
    const found = await getSchoolById(schoolId);
    return found ? { school: found } : { school: null, reason: 'NOT_FOUND' };
  }

  // 2) Name-based resolution
  if (schoolName) {
    const targetSlug = toSlug(schoolName);

    // Prefer precise city-scoped query if both country+city provided
    if (countryCode && city) {
      const { items } = await queryByCountryCity<any>(countryCode, city, 50);
      const exact = items.filter((s) => s?.nameSlug === targetSlug);
      if (exact.length === 1) return { school: exact[0] };
      if (exact.length === 0)  return { school: null, reason: 'NOT_FOUND' };
      return { school: null, reason: 'AMBIGUOUS' };
    }

    // Else try country-scoped name search (prefix)
    if (countryCode) {
      const { items } = await searchByName<any>(countryCode, schoolName, 50);
      // Prefer exact slug match if present
      const exact = items.filter((s) => s?.nameSlug === targetSlug);
      if (exact.length === 1) return { school: exact[0] };

      // If only one candidate at all, accept it
      if (items.length === 1) return { school: items[0] };

      // None or many → cannot decide
      return { school: null, reason: items.length === 0 ? 'NOT_FOUND' : 'AMBIGUOUS' };
    }

    // No country info; we avoid global scans — caller must use /schools first
    return { school: null, reason: 'AMBIGUOUS' };
  }

  // Nothing to resolve
  return { school: null, reason: 'NOT_FOUND' };
};
