import { Client, ButtonInteraction, ButtonBuilder } from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

type ButtonType = {
  name: string;
  button: ButtonBuilder;
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
