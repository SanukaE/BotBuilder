import getNamelessSuggestions from './getNamelessSuggestions.js';

/**
 * Retrieves and processes nameless suggestion data to extract unique categories and statuses.
 * 
 * @returns {Promise<{
 *   categories: Array<{ name: string; id: number }>;
 *   status: Array<{ name: string; id: number }>;
 * }>} An object containing:
 *   - categories: Array of unique category objects with name and id
 *   - status: Array of unique status objects with name and id
 * 
 * @remarks
 * The function performs the following steps:
 * 1. Fetches nameless suggestions
 * 2. If no suggestions exist, returns empty arrays for both categories and status
 * 3. Extracts all categories and status from suggestions
 * 4. Reduces arrays to contain only unique entries based on id
 */
export default async function (): Promise<{
  categories: Array<{ name: string; id: number; }>;
  status: Array<{ name: string; id: number; }>;
}> {
  const suggestions = await getNamelessSuggestions();

  if (!suggestions.length) return { categories: [], status: [] };

  const allCategories = suggestions.map((suggestion) => ({
    name: suggestion.category.name,
    id: suggestion.category.id,
  }));
  const allStatus = suggestions.map((suggestion) => ({
    name: suggestion.status.name,
    id: suggestion.status.id,
  }));

  const categories = allCategories.reduce<Array<{ name: string; id: number }>>(
    (acc, category) => {
      if (!acc.find(({ id }) => id === category.id)) acc.push(category);

      return acc;
    },
    []
  );

  const status = allStatus.reduce<Array<{ name: string; id: number }>>(
    (acc, status) => {
      if (!acc.find(({ id }) => id === status.id)) acc.push(status);

      return acc;
    },
    []
  );

  return { categories, status };
}
