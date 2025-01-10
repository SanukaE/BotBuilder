import Redis from '#libs/Redis.js';
import { createLogger, LoggerOptions } from './createLogger.js';

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
      EX: 60_000,
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
