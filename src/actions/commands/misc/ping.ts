import CommandType from '../../../utils/CommandType.js';

const command: CommandType = {
  name: 'ping',
  description: 'Gets bots ping.',

  async script(client, interaction) {
    await interaction.followUp(`Pong! ${client.ws.ping}ms.`);
  },
};

export default command;
