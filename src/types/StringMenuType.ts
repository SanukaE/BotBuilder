import { Client, StringSelectMenuInteraction } from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

/**
 * Represents the structure for a string select menu component in Discord.js
 * @interface
 * 
 * @property {string} customID - The unique identifier for the select menu
 * @property {bigint[]} [permissions] - Optional array of permission bit flags required to use this menu
 * @property {boolean} [isDevOnly] - Optional flag indicating if the menu is restricted to developers only
 * @property {boolean} [enableDebug] - Optional flag to enable debug logging for this menu
 * @property {boolean} [isDisabled] - Optional flag to disable the menu
 * @property {boolean} [isGuildOnly] - Optional flag indicating if the menu can only be used in guilds
 * @property {function} script - Async function that handles the menu interaction
 */
type StringMenuType = {
  customID: string;
  permissions?: bigint[];
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script: (
    client: Client,
    interaction: StringSelectMenuInteraction,
    debugStream: LoggerType
  ) => Promise<void>;
};

export default StringMenuType;
