import Redis from '#libs/Redis.js';
import { createLogger, LoggerOptions } from './createLogger.js';

/**
 * Retrieves groups from NamelessMC API or Redis cache.
 * 
 * @param includeStaff - Whether to include staff groups in the result. Defaults to false.
 * @returns Promise resolving to an array of group objects containing name and ID.
 *          Each group object has the format: { name: string, value: string }
 *          Returns empty array if API request fails.
 * 
 * @remarks
 * - First attempts to get groups from Redis cache using key 'namelessmc-groups'
 * - If cache miss, fetches from NamelessMC API and caches result for 60 seconds
 * - Logs errors to file if API request fails
 * - Can filter out staff groups based on includeStaff parameter
 */
export default async function (includeStaff = false) {
  const redisResult = await Redis.get('namelessmc-groups');

  let groups: any[] = [];

  if (redisResult) groups = JSON.parse(redisResult);
  else {
    const response = await fetch(process.env.NAMELESSMC_API_URL + '/groups', {
      headers: {
        Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
      },
    });

    const responseData = await response.json();

    if (responseData.error) {
      const errorLogger = createLogger(
        `namelessGroupAdd-command`,
        LoggerOptions.Error,
        true
      );

      errorLogger.write(
        `Failed to fetch from NamelessMC.\nError: ${responseData.error}${
          responseData.message ? '\nMessage :' + responseData.message : ''
        }, ${responseData.meta ? '\nMeta :' + responseData.meta : ''}`
      );

      errorLogger.close();

      return [];
    }

    groups = responseData.groups;

    await Redis.set('namelessmc-groups', JSON.stringify(groups), {
      EX: 60,
    });
  }

  const resultGroups = !includeStaff
    ? groups.filter((group) => !group.staff)
    : groups;

  return resultGroups.map((group) => ({
    name: group.name,
    value: group.id.toString(),
  }));
}
