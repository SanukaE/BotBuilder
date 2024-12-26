import { Client, ButtonInteraction } from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

type ButtonType = {
  customID: string;
  permissions?: bigint[];
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script?: (
    client: Client,
    interaction: ButtonInteraction,
    debugStream: LoggerType
  ) => Promise<void>;
};

export default ButtonType;
