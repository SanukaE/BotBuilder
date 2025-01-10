import CommandType from '#types/CommandType.js';
import getNamelessGroups from '#utils/getNamelessGroups.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'nameless-group-add',
  description: 'Add a NamelessMC group to a NamelessMC user.',
  isGuildOnly: true,
  options: [
    {
      name: 'user',
      description:
        'The user you want to add the group to. (Must have discord account linked)',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'group',
      description: 'The group you want to add.',
      type: ApplicationCommandOptionType.String,
      choices: await getNamelessGroups(),
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.ManageRoles],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const username = interaction.options.getUser('user', true).username;
    const namelessGroupID = interaction.options.getString('group', true);

    debugStream.write(`username: ${username}`);
    debugStream.write(`namelessGroupID: ${namelessGroupID}`);

    if (username === interaction.user.username) {
      debugStream.write(
        'The user picked is same as the user running the action. Sending response to user...'
      );

      await interaction.editReply(
        "You can't add a group for yourself. Please get a different staff member to do it for you."
      );

      debugStream.write('Reply sent!');
      return;
    }

    debugStream.write('Making API request...');

    const response = await fetch(
      process.env.NAMELESSMC_API_URL +
        `/users/integration_name:discord:${username}/groups/add`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
        body: JSON.stringify({ groups: [namelessGroupID] }),
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
    debugStream.write('Data collected! Sending follow up...');

    await interaction.followUp({
      content: 'Group was successfully add to user!',
    });

    debugStream.write('Message sent!');
  },
};

export default command;
