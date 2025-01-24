import Redis from '#libs/Redis.js';
import StringMenuType from '#types/StringMenuType.js';
import { NamelessMCFormFields } from '#utils/enums.js';
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
        process.env.NAMELESSMC_API_URL + `/forms/form/${formID}`,
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
        EX: 60,
      });
    }

    debugStream.write('Data collected! Creating embed...');

    const questions = form.fields.filter(
      (field: any) =>
        field.type !== NamelessMCFormFields.BARRIER &&
        field.type !== NamelessMCFormFields.HELP_BOX
    );

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: form.title,
      description:
        'You can fill this form either through Discord or our website. To use Discord, your account must be linked first.\n\n' +
        '📝 Options:\n' +
        '• Discord: Click "Fill form via Discord" (Note: Your DM\'s must be open & your discord account must be linked)\n' +
        '• Website: Click "Fill form via website"\n\n' +
        "⚠️ Important: Your progress won't be saved if you leave the form incomplete. (This only apply's only for the website)\n\n" +
        'Good luck! 🍀',
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[1]
        }&sz=128`,
      },
      fields: [
        { name: 'Total Questions:', value: questions.length, inline: true },

        {
          name: 'No of Required Questions:',
          value: questions.filter((question: any) => question.required).length,
          inline: true,
        },
      ],
    });

    debugStream.write('Embed created! Creating buttons...');

    const discordSubmitBtn = new ButtonBuilder({
      customId: `nameless-forms-discord-submit-${formID}`,
      emoji: '💬',
      style: ButtonStyle.Primary,
      label: 'Fill form via Discord',
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
      components: [actionRow],
    });

    debugStream.write('Follow up sent!');
  },
};

export default stringMenu;
