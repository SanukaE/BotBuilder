import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import formatFieldName from '#utils/formatFieldName.js';
import { ActionRowBuilder, Colors, StringSelectMenuBuilder } from 'discord.js';

const command: CommandType = {
  name: 'nameless-notifications',
  description:
    'Get a list of alerts you have on your NamelessMC account. (Must have discord linked)',

  async script(_, interaction, debugStream) {
    debugStream.write('Fetching data...');

    const redisResult = await Redis.get(
      `namelessmc-user-notifications-${interaction.user.username}`
    );

    let notifications: any[] = [];

    if (redisResult) notifications = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL +
          `/users/integration_name:discord:${interaction.user.username}/notifications`,
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

      notifications = responseData.notifications;

      await Redis.set(
        `namelessmc-user-notifications-${interaction.user.username}`,
        JSON.stringify(notifications),
        { EX: 60 }
      );
    }

    if (!notifications.length) {
      debugStream.write('User does not have an notification! Sending reply...');

      await interaction.editReply(
        'You currently do not have any notifications!'
      );

      debugStream.write('Reply sent!');
      return;
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      description: "Use the drop down to pick which alert you'd like to view.",
      title: 'Website Notifications',
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[1]
        }&sz=128`,
      },
    });

    let notificationTypes: string[] = [];

    //gets all the notification types
    for (const notification of notifications) {
      const notificationType: string = notification.type;

      if (!notificationTypes.includes(notificationType))
        notificationTypes.push(notificationType);
    }

    notificationTypes = notificationTypes.slice(0, 25);

    for (const notificationType of notificationTypes) {
      const notificationTypeNotifications = notifications.filter(
        (notification: { type: string }) =>
          notification.type === notificationType
      );

      embedMessage.addFields({
        name: `${formatFieldName(notificationType)}:`,
        value: `\`${notificationTypeNotifications.length}\``,
      });
    }

    debugStream.write('Embed created! Crating string menu...');

    const selectMenu = new StringSelectMenuBuilder({
      customId: 'nameless-notification',
      placeholder: 'Select a notification type to view.',
      options: notificationTypes.map((type) => ({
        label: formatFieldName(type),
        value: type,
      })),
    });
    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [selectMenu],
    });

    debugStream.write('String menu created! Sending message...');

    await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });

    debugStream.write('Message sent!');
  },
};

export default command;
