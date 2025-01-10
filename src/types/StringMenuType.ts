import { Client, StringSelectMenuInteraction } from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

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
