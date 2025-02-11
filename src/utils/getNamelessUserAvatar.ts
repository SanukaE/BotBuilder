import Redis from '#libs/Redis.js';

/**
 * Retrieves a user's avatar URL from NamelessMC API with Redis caching
 * 
 * @param namelessID - The NamelessMC user ID to fetch the avatar for
 * @returns Promise<string> URL of the user's avatar or website favicon if user doesn't exist
 * @throws {Error} When the NamelessMC API request fails
 * 
 * @description
 * First checks Redis cache for existing avatar URL
 * If not found, fetches from NamelessMC API
 * If user exists, caches result in Redis for 60 seconds
 * If user doesn't exist, returns website favicon as fallback
 */
export default async function (namelessID: number) {
  const redisResult = await Redis.get(`namelessmc-user-avatar-${namelessID}`);

  if (redisResult) return JSON.parse(redisResult);

  const response = await fetch(
    process.env.NAMELESSMC_API_URL + `/users/id:${namelessID}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
      },
    }
  );

  const responseData = await response.json();

  if (responseData.error)
    throw new Error(
      `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
        responseData.message ? 'Message :' + responseData.message : ''
      }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
    );

  if (!responseData.exists)
    return `https://www.google.com/s2/favicons?domain=${
      process.env.NAMELESSMC_API_URL!.split('/')[2]
    }&sz=128`;

  await Redis.set(
    `namelessmc-user-avatar-${namelessID}`,
    JSON.stringify(responseData.avatar_url),
    { EX: 60 }
  );

  return responseData.avatar_url;
}
