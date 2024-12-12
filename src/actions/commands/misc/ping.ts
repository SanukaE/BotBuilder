import CommandType from '../../../utils/CommandType.js';

const command: CommandType = {
  name: 'ping',
  description: 'Gets bots ping.',

  async script(client, interaction) {
    await interaction.followUp({
      content: `Pong! ${client.ws.ping}ms.`,
      ephemeral: true,
    });
  },
};

export default command;
