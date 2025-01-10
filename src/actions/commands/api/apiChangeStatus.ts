import CommandType from '#types/CommandType.js';
import MySQL from '#libs/MySQL.js';
import generateAPIKey from '#utils/generateAPIKey.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { RowDataPacket } from 'mysql2';

const command: CommandType = {
  name: 'api-change-status',
  description: 'Change a users API Key status.',
  isGuildOnly: true,
  options: [
    {
      name: 'user',
      description: 'The user you want to change the API status of.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'status',
      description: "The status you want to change the user's API key to.",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: 'ACTIVE', value: 'ACTIVE' },
        { name: 'REVOKED', value: 'REVOKED' },
      ],
      required: true,
    },
    {
      name: 'status-note',
      description: 'A note explaining why the status was changed.',
      type: ApplicationCommandOptionType.String,
      max_length: 255,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.ModerateMembers],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const userID = interaction.options.getUser('user')!.id;
    const newStatus = interaction.options.getString('status')!;
    const statusNote = interaction.options.getString('status-note')!;

    debugStream.write(`userID: ${userID}`);
    debugStream.write(`newStatus: ${newStatus}`);
    debugStream.write(`statusNote: ${statusNote}`);

    if (userID === interaction.user.id) {
      debugStream.write('Same user detected! Sending reply...');

      await interaction.editReply(
        "You can't run this command on yourself. Please get a different staff member to do it for you."
      );

      debugStream.write('Reply sent!');
      return;
    }

    debugStream.write('Fetching record for user...');
    const [rows] = await MySQL.query<RowDataPacket[]>(
      'SELECT * FROM api_keys WHERE userID = ?',
      [userID]
    );

    if (rows.length === 0) {
      debugStream.write(
        'No user found under provided ID. Creating a new record for user...'
      );
      const newAPIKey = await generateAPIKey();

      await MySQL.query(
        'INSERT INTO api_keys (userID, apiKey, keyStatus, statusNote) VALUES (?, ?, ?, ?)',
        [userID, newAPIKey, newStatus, statusNote]
      );

      debugStream.write('Record created! Sending user a follow up message...');

      await interaction.followUp({
        content: `
                No record found under user, <@${userID}>. 
                Therefor resulted in creating a new record for the user with status \`${newStatus}\` & note \`${statusNote}\`.
                `,
        ephemeral: true,
      });
    } else {
      debugStream.write('Record found! Updating db...');
      await MySQL.query('UPDATE api_keys SET keyStatus = ? WHERE userID = ?', [
        newStatus,
        userID,
      ]);

      await MySQL.query('UPDATE api_keys SET statusNote = ? WHERE userID = ?', [
        statusNote,
        userID,
      ]);
      debugStream.write('Record updated! Sending follow up message...');

      await interaction.followUp({
        content: `Update successful! Updated <@${userID}> with status \`${newStatus}\` & note \`${statusNote}\``,
      });
    }

    debugStream.write('Message sent!');
  },
};

export default command;
