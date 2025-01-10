import Redis from '#libs/Redis.js';
import StringMenuType from '#types/StringMenuType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
} from 'discord.js';

const stringMenu: StringMenuType = {
  customID: 'nameless-forms',

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const formID = interaction.values[0];

    debugStream.write(`formID: ${formID}`);

    debugStream.write('Fetching data...');

    const redisResult = await Redis.get(`namelessmc-form-${formID}`);

    let form: any;

    if (redisResult) form = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + `/forms/${formID}`,
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

      form = responseData;

      await Redis.set(`namelessmc-form-${formID}`, JSON.stringify(form), {
        EX: 60_000,
      });
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: form.title,
      description:
        'You can fill this form either through Discord or our website. To use Discord, your account must be linked first.\n\n' +
        '📝 Options:\n' +
        '• Discord: Click "Fill form via Discord" (Note: This feature is still a W.I.P)\n' +
        '• Website: Click "Fill form via website"\n\n' +
        "⚠️ Important: Your progress won't be saved if you leave the form incomplete.\n\n" +
        'Good luck! 🍀',
      thumbnail: { url: 'https://i.postimg.cc/Kz6WKb69/Nameless-MC-Logo.png' },
      fields: [], //TODO: Display the amount of different question types.
    });

    debugStream.write('Embed created! Creating buttons...');

    const discordSubmitBtn = new ButtonBuilder({
      customId: `nameless-forms-discord-submit-${formID}`,
      emoji: '💬',
      style: ButtonStyle.Primary,
      label: 'Fill form via Discord (W.I.P)',
      disabled: true, //! W.I.P
    });

    const websiteSubmitBtn = new ButtonBuilder({
      emoji: '🔗',
      style: ButtonStyle.Link,
      label: 'Fill form via website',
      url: form.url_full,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [discordSubmitBtn, websiteSubmitBtn],
    });

    debugStream.write('Buttons created! Sending follow up...');

    await interaction.followUp({
      embeds: [embedMessage],
    });

    debugStream.write('Follow up sent!');
  },
};

export default stringMenu;
