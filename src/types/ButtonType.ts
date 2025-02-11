import { Client, ButtonInteraction } from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

/**
 * Represents the structure for a Discord button interaction handler.
 * @interface ButtonType
 * 
 * @property {string} customID - The unique identifier for the button.
 * @property {bigint[]} [permissions] - Optional array of permission flags required to use the button.
 * @property {boolean} [isDevOnly] - Optional flag indicating if the button is restricted to developers only.
 * @property {boolean} [enableDebug] - Optional flag to enable debug logging for this button.
 * @property {boolean} [isDisabled] - Optional flag indicating if the button is currently disabled.
 * @property {boolean} [isGuildOnly] - Optional flag indicating if the button can only be used in guilds.
 * @property {function} script - Async function that handles the button interaction.
 */
type ButtonType = {
  customID: string;
  permissions?: bigint[];
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script: (
    client: Client,
    interaction: ButtonInteraction,
    debugStream: LoggerType
  ) => Promise<void>;
};

export default ButtonType;
