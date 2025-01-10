import CommandType from '#types/CommandType.js';
import { PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'nameless-update-usernames',
  description: 'Updates all your members usernames to your website.',
  isGuildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const guildUsers = (await interaction.guild!.members.fetch())
      .filter((member) => !member.user.bot)
      .map((member) => member.user);

    debugStream.write('Making API request...');

    const response = await fetch(
      process.env.NAMELESSMC_API_URL + '/discord/update-usernames',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
        body: JSON.stringify({
          users: guildUsers.map((user) => ({
            id: user.id,
            name: user.username,
          })),
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
      content: "Username's updated!",
    });

    debugStream.write('Message sent!');
  },
};

export default command;
