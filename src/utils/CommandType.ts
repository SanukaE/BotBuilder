import {
  Client,
  ChatInputCommandInteraction,
  APIApplicationCommandOption,
} from 'discord.js';

type CommandType = {
  id?: string;
  name: string;
  description: string;
  options?: APIApplicationCommandOption[];
  permissions?: bigint[];
  isDevOnly?: boolean;
  isToDelete?: boolean;
  script?: (client: Client, interaction: ChatInputCommandInteraction) => void;
};

export default CommandType;
