import CommandType from '#types/CommandType.js';
import MySQL from '#libs/MySQL.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { RowDataPacket } from 'mysql2';

const command: CommandType = {
  name: 'api-status',
  description: 'Check a users API Key status.',
  isGuildOnly: true,
  options: [
    {
      name: 'user',
      description: 'The user you what to check the API Key status of.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.ModerateMembers],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const userID = interaction.options.getUser('user')!.id;
    debugStream.write(`userID: ${userID}`);

    debugStream.write('Getting data from db...');
    const [rows] = await MySQL.query<RowDataPacket[]>(
      'SELECT keyStatus, statusNote FROM api_keys WHERE userID = ?',
      [userID]
    );
    debugStream.write('Data received!');

    debugStream.write('Checking if user is registered to use the API...');
    if (rows.length === 0) {
      debugStream.write('User is not registered! Sending follow up message...');

      await interaction.followUp({
        content: `This user (<@${userID}>) isn't registered to the API yet!`,
        ephemeral: true,
      });
    } else {
      debugStream.write('The user is registered! Send a follow up message...');
      const { keyStatus, statusNote } = rows[0];

      await interaction.followUp({
        content: `${
          keyStatus === 'ACTIVE' ? '✔' : '❌'
        } Status: \`${keyStatus}\`\n📝 Status Note: \`${statusNote || 'N/A'}\``,
      });
    }

    debugStream.write('Message sent!');
  },
};

export default command;
