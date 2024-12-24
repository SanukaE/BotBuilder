import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import dbPool from '#utils/dbPool.js';
import generateAPIKey from '#utils/generateAPIKey.js';
import { RowDataPacket } from 'mysql2';
import config from '../../../../config.json' assert { type: 'json' };
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const command: CommandType = {
  name: 'api-key',
  description: "Shows your API Key to use BotBuilder's API.",

  async script(client, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const userID = interaction.user.id;
    debugStream.write(`userID: ${userID}`);

    debugStream.write('Getting data from config...');
    const { webServerIP, webServerPort } = config;
    debugStream.write(`webServerIP: ${webServerIP}`);
    debugStream.write(`webServerPort: ${webServerPort}`);

    debugStream.write('Getting data from db...');
    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT * FROM api_keys WHERE userID = ?',
      [userID]
    );
    debugStream.write('Data received! Setting up embed message...');

    const embedMessage = createEmbed({
      title: 'BotBuilder API:',
      description:
        'To learn how to use the API please visit the page linked to the button below.',
      thumbnail: { url: client.user?.displayAvatarURL() || '' },
    });

    debugStream.write('Creating button row...');
    const endpointsBtn = new ButtonBuilder({
      emoji: '🔗',
      label: 'View All Endpoints',
      style: ButtonStyle.Link,
      url: `http://${webServerIP}:${webServerPort}/`,
    });
    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [endpointsBtn],
    });
    debugStream.write('Row created! Getting data from db row...');

    let keyData = {
      userID,
      apiKey: '',
      keyStatus: 'ACTIVE',
      statusNote: null,
    };

    if (rows.length === 0) {
      debugStream.write("The user doesn't have an API key. Generating one...");
      keyData.apiKey = await generateAPIKey();

      debugStream.write('Inserting key into db...');
      await dbPool.query(
        'INSERT INTO api_keys (userID, apiKey) VALUES (?, ?)',
        [userID, keyData.apiKey]
      );
      debugStream.write('Done!');

      embedMessage.setColor('Green');
    } else {
      keyData.apiKey = rows[0].apiKey;
      keyData.keyStatus = rows[0].keyStatus;
      keyData.statusNote = rows[0].statusNote;

      embedMessage.setColor(keyData.keyStatus === 'ACTIVE' ? 'Green' : 'Red');
    }

    debugStream.write('Setting embed fields...');
    embedMessage.setFields([
      { name: 'Key:', value: `\`${keyData.apiKey}\``, inline: true },
      { name: 'Status:', value: `\`${keyData.keyStatus}\``, inline: true },
      {
        name: 'Note:',
        value: `\`${keyData.statusNote || 'N/A'}\``,
        inline: true,
      },
    ]);

    debugStream.write('Sending follow up to user...');
    await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
      ephemeral: true,
    });
    debugStream.write('Done!');
  },
};

export default command;
