import CommandType from '#types/CommandType.js';
import { ApplicationCommandOptionType } from 'discord.js';

const command: CommandType = {
  name: 'misc-message-preview',
  description: 'Preview a message before sending it',
  options: [
    {
      name: 'content',
      description: 'The message content you want to view.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const messageContent = interaction.options.getString('content', true);
    debugStream.write(
      messageContent.length > 10
        ? messageContent.slice(0, 10) + '...'
        : messageContent
    );

    debugStream.write('Sending follow up...');
    await interaction.followUp({ content: messageContent, ephemeral: true });
    debugStream.write('Follow up sent!');
  },
};

export default command;
