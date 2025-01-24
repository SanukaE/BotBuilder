import StringMenuType from '#types/StringMenuType.js';
import Redis from '#libs/Redis.js';

const stringMenu: StringMenuType = {
  customID: 'nameless-announcement',

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const announcementID = interaction.values[0];

    debugStream.write(`announcementID: ${announcementID}`);
    debugStream.write('Getting data from API...');

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
        { EX: 60 }
      );
    }

    const announcement = announcements.find(
      (announcement: any) => announcement.id == announcementID
    );

    debugStream.write('Data collected! Sending follow up...');

    await interaction.followUp({
      content: `## ${announcement.header}\n\n` + announcement.message,
    });

    debugStream.write('Message Sent!');
  },
};

export default stringMenu;
