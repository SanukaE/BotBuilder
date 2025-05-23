import Redis from '#libs/Redis.js';

type Suggestion = {
  id: number;
  link: string;
  author: {
    id: number;
    nickname: string;
    username: string;
  };
  updated_by: {
    id: number;
    username: string;
  };
  status: {
    id: number;
    name: string;
    open: boolean;
  };
  category: {
    id: number;
    name: string;
  };
  title: string;
  content: string;
  views: number;
  created: number;
  last_updated: number;
  likes_count: number;
  dislikes_count: number;
  likes: number[];
  dislikes: number[];
};

/**
 * Fetches and caches suggestions from NamelessMC API.
 * 
 * This function first checks Redis cache for suggestions. If not found, it fetches from the API:
 * 1. Gets all suggestions from the main endpoint
 * 2. For each suggestion, fetches detailed data and caches individually
 * 3. Caches the full suggestions array
 * 
 * All cache entries expire after 60 seconds.
 * 
 * @throws {Error} If the NamelessMC API request fails with an error
 * @returns {Promise<Suggestion[]>} Array of suggestion objects containing detailed suggestion data
 */
export default async function () {
  const redisResult = await Redis.get('namelessmc-suggestions');

  let suggestions: Suggestion[] = [];

  if (redisResult) suggestions = JSON.parse(redisResult);
  else {
    const response = await fetch(
      process.env.NAMELESSMC_API_URL + `/suggestions`,
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

    suggestions = await Promise.all(
      responseData.suggestions.map(async (suggestion: any) => {
        const redisResult = await Redis.get(
          `namelessmc-suggestion-${suggestion.id}`
        );
        let currentSuggestion: Suggestion;

        if (redisResult) currentSuggestion = JSON.parse(redisResult);
        else {
          const response = await fetch(
            process.env.NAMELESSMC_API_URL + `/suggestions/${suggestion.id}`,
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

          currentSuggestion = responseData;

          await Redis.set(
            `namelessmc-suggestion-${suggestion.id}`,
            JSON.stringify(currentSuggestion),
            { EX: 60 }
          );
        }

        return currentSuggestion;
      })
    );

    await Redis.set('namelessmc-suggestions', JSON.stringify(suggestions), {
      EX: 60,
    });
  }

  return suggestions;
}
