import CommandType from '#types/CommandType.js';

const command: CommandType = {
  name: 'misc-ping',
  description: 'Gets bots ping.',

  async script(client, interaction) {
    await interaction.followUp({
      content: `Pong! ${client.ws.ping}ms.`,
    });
  },
};

export default command;
