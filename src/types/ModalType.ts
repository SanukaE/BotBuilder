import { Client, ModalSubmitInteraction } from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

/**
 * Represents the structure of a modal interaction handler.
 * 
 * @interface ModalType
 * @property {string} customID - The unique identifier for the modal.
 * @property {bigint[]} [permissions] - Optional array of permission flags required to use the modal.
 * @property {boolean} [isDevOnly] - Optional flag indicating if the modal is restricted to developers only.
 * @property {boolean} [enableDebug] - Optional flag to enable debug logging for the modal.
 * @property {boolean} [isDisabled] - Optional flag to disable the modal.
 * @property {boolean} [isGuildOnly] - Optional flag indicating if the modal can only be used in guilds.
 * @property {Function} script - Async function that handles the modal submission.
 */
type ModalType = {
  customID: string;
  permissions?: bigint[];
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script: (
    client: Client,
    interaction: ModalSubmitInteraction,
    debugStream: LoggerType
  ) => Promise<void>;
};

export default ModalType;
