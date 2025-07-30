import {
  Client,
  ChatInputCommandInteraction,
  APIApplicationCommandOption,
  AutocompleteInteraction,
} from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

/**
 * Represents the structure of a Discord bot command.
 * @interface
 * @property {string} [id] - The unique identifier of the command.
 * @property {string} name - The name of the command.
 * @property {string} description - The description of the command.
 * @property {APIApplicationCommandOption[]} [options] - The command options/arguments.
 * @property {bigint[]} [permissions] - Required permissions to execute the command.
 * @property {boolean} [isDevOnly] - Whether the command is restricted to developers only.
 * @property {boolean} [enableDebug] - Whether debug mode is enabled for the command.
 * @property {boolean} [isDisabled] - Whether the command is currently disabled.
 * @property {boolean} [isGuildOnly] - Whether the command can only be used in guilds.
 * @property {function} [script] - The command execution function.
 */
type CommandType = {
  id?: string;
  name: string;
  description: string;
  options?: APIApplicationCommandOption[];
  permissions?: bigint[];
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script?: (
    client: Client,
    interaction: ChatInputCommandInteraction,
    debugStream: LoggerType
  ) => Promise<void>;
  handleAutoComplete?: (
    client: Client,
    interaction: AutocompleteInteraction,
    focusedOption: string
  ) => Promise<void>;
};

export default CommandType;
