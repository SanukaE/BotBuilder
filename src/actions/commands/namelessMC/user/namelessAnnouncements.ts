import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import { ActionRowBuilder, Colors, StringSelectMenuBuilder } from 'discord.js';

const command: CommandType = {
  name: 'nameless-announcements',
  description:
    'Get a list of all the announcements you can view. (Must have discord account linked)',

  async script(_, interaction, debugStream) {
    debugStream.write('Making request...');

    const redisResult = await Redis.get(
      `namelessmc-user-announcements-${interaction.user.username}`
    );

    let announcements: any[] = [];

    if (redisResult) announcements = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL +
          `/users/integration_name:discord:${interaction.user.username}/announcements`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
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

      announcements = responseData.announcements;

      await Redis.set(
        `namelessmc-user-announcements-${interaction.user.username}`,
        JSON.stringify(announcements),
        { EX: 60_000 }
      );
    }

    debugStream.write('Data collected! Creating embed & select menu...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      description: announcements.length
        ? 'Use the select menu to navigate each announcement.'
        : 'There are no announcements for you to view.',
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[1]
        }&sz=128`,
      },
      title: 'Website Announcements',
    });
    const selectMenu = new StringSelectMenuBuilder({
      customId: 'nameless-announcement',
      placeholder: 'Select an announcement to view.',
    });

    for (const announcement of announcements) {
      embedMessage.addFields({
        name: `#${announcement.id}`,
        value: announcement.header,
        inline: true,
      });

      selectMenu.addOptions({
        label: announcement.header.slice(0, 100),
        value: announcement.id.toString(),
      });
    }

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [selectMenu],
    });

    debugStream.write('Done! Sending follow up to user...');
    await interaction.followUp({
      embeds: [embedMessage],
      components: announcements.length ? [actionRow] : [],
    });
    debugStream.write('Message sent!');
  },
};

export default command;
