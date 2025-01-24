import getNamelessSuggestions from './getNamelessSuggestions.js';

export default async function () {
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
