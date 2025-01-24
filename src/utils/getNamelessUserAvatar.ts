import Redis from '#libs/Redis.js';

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
      process.env.NAMELESSMC_API_URL!.split('/')[1]
    }&sz=128`;

  await Redis.set(
    `namelessmc-user-avatar-${namelessID}`,
    JSON.stringify(responseData.avatar_url),
    { EX: 60 }
  );

  return responseData.avatar_url;
}
