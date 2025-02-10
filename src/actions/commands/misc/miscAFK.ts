import MySQL from '#libs/MySQL.js';
import CommandType from '#types/CommandType.js';
import { ApplicationCommandOptionType } from 'discord.js';

const command: CommandType = {
  name: 'misc-afk',
  description: 'Set an AFK message for users who mention you to see.',
  options: [
    {
      name: 'message',
      description: 'Message you want users to see when they mention you.',
      type: ApplicationCommandOptionType.String,
      max_length: 255,
      required: true,
    },
  ],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const message = interaction.options.getString('message', true);

    debugStream.write(
      `message: ${message.length > 10 ? message.slice(0, 10) + '...' : message}`
    );

    await MySQL.query(
      'INSERT INTO afk_users (userID, afkMessage) VALUES (?, ?) ON DUPLICATE KEY UPDATE afkMessage = ?',
      [interaction.user.id, message, message]
    );

    await interaction.followUp({
      content: 'Your AFK message has been set!',
      ephemeral: true,
    });
  },
};

export default command;
