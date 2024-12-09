import {
  Client,
  ChatInputCommandInteraction,
  APIApplicationCommandOption,
} from 'discord.js';
import { LoggerType } from './createLogger.js';

type CommandType = {
  id?: string;
  name: string;
  description: string;
  options?: APIApplicationCommandOption[];
  permissions?: bigint[];
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  script?: (
    client: Client,
    interaction: ChatInputCommandInteraction,
    debugStream: LoggerType
  ) => Promise<void>;
};

export default CommandType;
