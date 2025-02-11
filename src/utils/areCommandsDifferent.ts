import {
  APIApplicationCommandOption,
  APIApplicationCommandOptionChoice,
} from 'discord.js';
import CommandType from '#types/CommandType.js';

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
  if (localCommand.description !== registeredCommand.description) return true;
  if (localCommand.options?.length !== registeredCommand.options?.length)
    return true;

  for (const localOption of localCommand.options || []) {
    const registeredOption = registeredCommand.options?.find(
      (option) => option.name === localOption.name
    );

    if (!registeredOption) return true;
    if (localOption.description !== registeredOption.description) return true;
    if (localOption.required !== registeredOption.required) return true;
    if (localOption.type !== registeredOption.type) return true;

    if (
      'min_value' in localOption &&
      localOption.min_value !== (registeredOption as any).min_value
    )
      return true;
    if (
      'max_value' in localOption &&
      localOption.max_value !== (registeredOption as any).max_value
    )
      return true;

    const localChoices = (
      localOption as APIApplicationCommandOption & {
        choices?: APIApplicationCommandOptionChoice<string>[];
      }
    ).choices;
    const registeredChoices = (
      registeredOption as APIApplicationCommandOption & {
        choices?: APIApplicationCommandOptionChoice<string>[];
      }
    ).choices;

    if (localChoices?.length !== registeredChoices?.length) return true;

    if (localChoices) {
      for (const localChoice of localChoices) {
        const registeredChoice = registeredChoices?.find(
          (choice) => choice.name === localChoice.name
        );

        if (!registeredChoice || localChoice.value !== registeredChoice.value)
          return true;
      }
    }
  }

  return false;
}
