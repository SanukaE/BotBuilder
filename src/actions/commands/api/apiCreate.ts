import CommandType from '#types/CommandType.js';
import MySQL from '#libs/MySQL.js';
import generateAPIKey from '#utils/generateAPIKey.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { RowDataPacket } from 'mysql2';
import config from '#config' assert { type: 'json' };

const command: CommandType = {
  name: 'api-create',
  description: 'Create/regenerate a new API Key.',

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const userID = interaction.user.id;
    debugStream.write(`userID: ${userID}`);

    debugStream.write('Generating new API Key...');
    const newAPIKey = await generateAPIKey();
    debugStream.write('Key generated! Getting data from db...');

    const [rows] = await MySQL.query<RowDataPacket[]>(
      'SELECT apiKey FROM api_keys WHERE userID = ?',
      [userID]
    );
    debugStream.write('Data received! Getting values from config...');

    const { webServerIP, webServerPort } = config;
    debugStream.write(`webServerIP: ${webServerIP}`);
    debugStream.write(`webServerPort: ${webServerPort}`);

    debugStream.write('Creating endpoints button...');
    const endpointsBtn = new ButtonBuilder({
      emoji: '🔗',
      label: 'View Endpoints',
      style: ButtonStyle.Link,
      url: `http://${webServerIP}:${webServerPort}/`,
    });
    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [endpointsBtn],
    });
    debugStream.write('Button created! Checking if user already has a key...');

    if (rows.length === 0) {
      debugStream.write('User is new! Creating new record...');
      await MySQL.query('INSERT INTO api_keys (userID, apiKey) VALUES (?, ?)', [
        userID,
        newAPIKey,
      ]);
      debugStream.write('Record made!');
    } else {
      debugStream.write('Updating existing users record...');
      await MySQL.query('UPDATE api_keys SET apiKey = ? WHERE userID = ?', [
        newAPIKey,
        userID,
      ]);
      debugStream.write('Record updated!');
    }

    debugStream.write('Sending follow up message to user...');
    await interaction.followUp({
      content: `
        A new API key has been generated under your account. **Do not share this with anyone.**
        \nAPI Key: ||\`${newAPIKey}\`||
        \nTo learn how to use this key please visit the page linked to the button below.
        \n-# Treat this key like your discord password.`,
      components: [actionRow],
    });
    debugStream.write('Message sent!');
  },
};

export default command;
