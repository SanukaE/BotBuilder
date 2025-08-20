import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import getConfig from "#utils/getConfig.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";
import { RowDataPacket } from "mysql2";

const ticketConfig = getConfig("support") as any;

const command: CommandType = {
  name: "ticket-panel",
  description: "Sends a panel for opening a ticket in the current channel.",
  isDisabled: !ticketConfig.enableTicketSystem,
  options: [
    {
      name: "embed-title",
      description: "The embed you want to use.",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
  ],
  isGuildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  async handleAutoComplete(client, interaction, focusedOption) {
    try {
      const [rows] = await MySQL.query<RowDataPacket[]>(
        "SELECT title FROM embeds WHERE title LIKE ? LIMIT 25",
        [`%${focusedOption}%`]
      );

      if (!rows.length) {
        await interaction.respond([]);
        return;
      }

      await interaction.respond(
        rows.map((row) => ({ name: row.title, value: row.title }))
      );
    } catch (error) {
      console.error("Autocomplete error:", error);
      await interaction.respond([]);
    }
  },

  async script(client, interaction, debugStream) {
    const embedTitle = interaction.options.getString("embed-title", true);
    const postChannel = interaction.channel!;

    if (!postChannel.isSendable())
      throw new Error("No permission to send message in this channel");

    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM embeds WHERE title = ?",
      [embedTitle]
    );
    if (!rows || rows.length === 0) throw new Error("Embed not found");

    const embedData = rows[0];
    const embedMessage = new EmbedBuilder({
      color: embedData.color ? embedData.color : undefined,
      description: embedData.description ? embedData.description : undefined,
      fields: embedData.fields ? embedData.fields : undefined,
      author: embedData.author ? embedData.author : undefined,
      footer: embedData.footer ? embedData.footer : undefined,
      image: embedData.image_url ? embedData.image_url : undefined,
      thumbnail: embedData.thumbnail_url
        ? { url: embedData.thumbnail_url }
        : undefined,
      title: embedData.title,
      url: embedData.url ? embedData.url : undefined,
    });

    const stringMenu = new StringSelectMenuBuilder({
      customId: "ticket-panel-select",
      placeholder: "Select a ticket type",
      options: ticketConfig.ticketCategories.map((cat: string) => {
        const [categoryName] = cat.split(":");

        return {
          label: categoryName,
          value: cat,
          description: `Open a ticket for ${categoryName}`,
        };
      }),
      max_values: 1,
    });

    await postChannel.sendTyping();

    await postChannel.send({
      embeds: [embedMessage],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>({
          components: [stringMenu],
        }),
      ],
    });
    await interaction.followUp("Ticket Panel Sent!");
  },
};

export default command;
