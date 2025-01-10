import CommandType from '#types/CommandType.js';
import { PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'nameless-submit-role',
  description: 'Submit your discord server roles to your website.',
  isGuildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const roles = await interaction.guild!.roles.fetch();

    debugStream.write('Making API request...');

    const response = await fetch(
      process.env.NAMELESSMC_API_URL + '/discord/submit-role-list',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
        body: JSON.stringify({
          roles: roles.map((role) => ({ id: role.id, name: role.name })),
        }),
      }
    );

    debugStream.write(`Response Status: ${response.status}`);

    debugStream.write('Getting JSON data...');
    const responseData = await response.json();

    if (responseData.error)
      throw new Error(
        `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
          responseData.message ? 'Message :' + responseData.message : ''
        }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
      );

    debugStream.write('No errors! Sending follow up...');

    await interaction.followUp({
      content: 'Roles submitted!',
    });

    debugStream.write('Message sent!');
  },
};

export default command;
