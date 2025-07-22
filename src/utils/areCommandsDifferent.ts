import {
  APIApplicationCommandOption,
  APIApplicationCommandOptionChoice,
} from "discord.js";
import CommandType from "#types/CommandType.js";

/**
 * Compares a local command with a registered command to determine if they are different.
 *
 * @param localCommand - The local command to compare
 * @param registeredCommand - The registered command to compare against
 * @returns {boolean} True if commands are different, false if they are the same
 *
 * Checks the following differences:
 * - Command descriptions
 * - Number of options
 * - For each option:
 *   - Existence of matching option by name
 *   - Option descriptions
 *   - Required status
 *   - Option type
 *   - Minimum and maximum values (if applicable)
 *   - Number of choices
 *   - Choice names and values
 */
export default function areCommandsDifferent(
  localCommand: CommandType,
  registeredCommand: CommandType
) {
  // Compare basic properties
  if (localCommand.description !== registeredCommand.description) return true;

  // Compare options length (undefined treated as empty array)
  const localOptions = localCommand.options ?? [];
  const registeredOptions = registeredCommand.options ?? [];
  if (localOptions.length !== registeredOptions.length) return true;

  // Compare each option by name
  for (const localOption of localOptions) {
    const registeredOption = registeredOptions.find(
      (opt) => opt.name === localOption.name
    );
    if (!registeredOption) return true;

    // Compare option properties
    if (localOption.description !== registeredOption.description) return true;
    if ((localOption.required ?? false) !== registeredOption.required)
      return true;
    if (localOption.type !== registeredOption.type) return true;
    if (
      "autocomplete" in localOption &&
      "autocomplete" in registeredOption &&
      localOption.autocomplete !== registeredOption.autocomplete
    )
      return true;

    // Compare min/max values (support both camelCase and snake_case)
    const getMin = (opt: any) => opt.min_value ?? opt.minValue;
    const getMax = (opt: any) => opt.max_value ?? opt.maxValue;
    if (getMin(localOption) !== getMin(registeredOption)) return true;
    if (getMax(localOption) !== getMax(registeredOption)) return true;

    // Compare choices (order-insensitive)
    const localChoices = (localOption as any).choices ?? [];
    const registeredChoices = (registeredOption as any).choices ?? [];
    if (localChoices.length !== registeredChoices.length) return true;

    for (const localChoice of localChoices) {
      const regChoice = registeredChoices.find(
        (c: any) => c.name === localChoice.name && c.value === localChoice.value
      );
      if (!regChoice) return true;
    }
  }

  return false;
}
