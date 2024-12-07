import { Client, ChatInputCommandInteraction } from 'discord.js';
import CommandType from '../../../utils/CommandType.js';

const command: CommandType = {
  name: 'ping',
  description: 'Gets bots ping.',

  script: async (client: Client, interaction: ChatInputCommandInteraction) => {
    await interaction.reply(`Pong! ${client.ws.ping}ms.`);
  },
};

export default command;
