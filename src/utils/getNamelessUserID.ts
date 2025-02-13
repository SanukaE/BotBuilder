import Redis from '#libs/Redis.js';

/**
 * Retrieves a NamelessMC user ID by their Discord username.
 * First checks Redis cache, then falls back to NamelessMC API if not found.
 * 
 * @param username - The Discord username to look up
 * @returns Promise resolving to the NamelessMC user ID
 * @throws {Error} If the API request fails or user is not found/linked
 *
 * @example
 * ```typescript
 * try {
 *   const userId = await getNamelessUserID('discord#1234');
 *   console.log(userId); // 123
 * } catch (err) {
 *   console.error('Failed to get user ID:', err);
 * }
 * ```
 */
export default async function (username: string): Promise<Number> {
  let user: any;

  const redisResult = await Redis.get(`namelessmc-user-${username}`);

  if (redisResult) user = JSON.parse(redisResult);
  else {
    const response = await fetch(
      process.env.NAMELESSMC_API_URL +
        `/users/integration_name:discord:${username}`,
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
      throw new Error(
        'User with username `${username}` does not have their account linked.'
      );

    user = responseData;

    await Redis.set(`namelessmc-user-${username}`, JSON.stringify(user), {
      EX: 60,
    });
  }

  return user.id;
}
