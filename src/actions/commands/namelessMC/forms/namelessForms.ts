import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import { ActionRowBuilder, Colors, StringSelectMenuBuilder } from 'discord.js';

const command: CommandType = {
  name: 'nameless-forms',
  description: 'Get a list of all forms on the website.',

  async script(_, interaction, debugStream) {
    debugStream.write('Fetching data...');

    const redisResult = await Redis.get('namelessmc-forms');

    let forms: any[] = [];

    if (redisResult) forms = JSON.parse(redisResult);
    else {
      const response = await fetch(process.env.NAMELESSMC_API_URL + '/forms', {
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
      });

      debugStream.write(`Response Status: ${response.status}`);

      debugStream.write('Getting JSON data...');
      const responseData = await response.json();

      if (responseData.error)
        throw new Error(
          `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
            responseData.message ? 'Message :' + responseData.message : ''
          }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
        );

      forms = responseData.forms;

      await Redis.set('namelessmc-forms', JSON.stringify(forms), {
        EX: 60,
      });
    }

    if (!forms.length) {
      debugStream.write('There are no forms created! Sending reply...');

      await interaction.editReply(
        'Currently there are no forms on the website!'
      );

      debugStream.write('Reply sent!');
      return;
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: 'Website Forms',
      description:
        'Use the select menu bellow to pick a form you want to apply for.',
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[2]
        }&sz=128`,
      },
    });

    debugStream.write('Embed created! Creating select menu...');

    const selectMenu = new StringSelectMenuBuilder({
      customId: 'nameless-forms',
      options: forms.map((form) => ({
        label: form.title,
        value: form.id.toString(),
      })),
      placeholder: 'What from do you want to apply?',
    });

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [selectMenu],
    });

    debugStream.write('Select menu created! Sending follow up...');

    await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });

    debugStream.write('Follow up sent!');
  },
};

export default command;
