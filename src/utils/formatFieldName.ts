/**
 * Formats a string by converting it from kebab/snake case to title case.
 * @param name - The string to be formatted (e.g., "my-field-name" or "my_field_name")
 * @returns The formatted string with each word capitalized and separated by spaces (e.g., "My Field Name")
 * @example
 * ```typescript
 * formatFieldName("user-name") // returns "User Name"
 * formatFieldName("first_name") // returns "First Name"
 * ```
 */
export default function (name: string) {
  const formattedName = name
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return formattedName;
}
