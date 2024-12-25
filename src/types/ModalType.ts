import { Client, ModalSubmitInteraction, ModalBuilder } from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

type ModalType = {
  name: string;
  modal: ModalBuilder;
  permissions?: bigint[];
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script?: (
    client: Client,
    interaction: ModalSubmitInteraction,
    debugStream: LoggerType
  ) => Promise<void>;
};

export default ModalType;
