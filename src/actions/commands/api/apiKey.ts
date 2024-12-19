import { ApplicationCommandOptionType } from 'discord.js';
import CommandType from '../../../utils/CommandType.js';

const command: CommandType = {
  name: 'api-key',
  description: "Shows your API Key to use BotBuilder's API.",
  enableDebug: true,
  isDevOnly: true,

  async script(client, interaction, debugStream) {
    //TODO: Fetch API Key from DB.
  },
};

export default command;
