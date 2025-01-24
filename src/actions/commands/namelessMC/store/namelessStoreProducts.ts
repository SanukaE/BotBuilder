import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  Colors,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';

const command: CommandType = {
  name: 'nameless-store-products',
  description: 'View all your store products. (NamelessMC Store Module)',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Making API request...');

    let storeCategories: any[] = [];

    const redisResult = await Redis.get('namelessmc-store-categories');

    if (redisResult) storeCategories = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + `/store/categories`,
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

      storeCategories = responseData.categories;

      await Redis.set(
        'namelessmc-store-categories',
        JSON.stringify(storeCategories),
        { EX: 60 }
      );
    }

    if (!storeCategories.length) {
      debugStream.write('No store categories found!');
      await interaction.editReply('No store categories found.');
      return;
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: 'Store Products',
      description:
        'Use the select menu below to view the products in a specific category.',
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[1]
        }&sz=128`,
      },
      fields: storeCategories.map((category: any) => ({
        name: `📁 ${category.name}`,
        value: `ID: \`${category.id}\`\nHidden: ${
          category.hidden ? '✔' : '❌'
        }\nDisabled: ${category.disabled ? '✔' : '❌'}`,
      })),
    });

    debugStream.write('Embed created! Creating select menu...');

    const selectMenu = new StringSelectMenuBuilder({
      customId: 'nameless-store-products-categories',
      placeholder: 'Select a category to view products',
      options: storeCategories.map((category: any) => ({
        label: category.name,
        value: category.id.toString(),
      })),
    });

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [selectMenu],
    });

    debugStream.write('Menu created! Sending follow up...');

    await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });

    debugStream.write('Follow up sent!');
  },
};

export default command;
