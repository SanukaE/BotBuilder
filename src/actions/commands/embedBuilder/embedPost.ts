import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import {
  ApplicationCommandOptionType,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { RowDataPacket } from "mysql2";

const command: CommandType = {
  name: "embed-post",
  description:
    "Post an already created embed to the current channel or a channel you select",
  isGuildOnly: true,
  options: [
    {
      name: "embed-title",
      description: "The title of the embed you want to post",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
    {
      name: "channel",
      description: "The channel you would like to post the embed at",
      type: ApplicationCommandOptionType.Channel,
      channel_types: [ChannelType.GuildText],
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async handleAutoComplete(client, interaction, focusedOption) {
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT title FROM embeds"
    );

    const focusedValues = rows.filter((row) =>
      row.title.startsWith(focusedOption)
    );
    if (!focusedValues.length) return;

    await interaction.respond(
      focusedValues.map((v) => ({ name: v.title, value: v.title }))
    );
  },

  async script(client, interaction, debugStream) {
    const embedTitle = interaction.options.getString("embed-title", true);
    const postChannel =
      interaction.options.getChannel<ChannelType.GuildText>("channel") ||
      interaction.channel!;

    if (!postChannel.isSendable())
      throw new Error("No permission to send message in this channel");

    await postChannel.sendTyping();

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
      image: embedData.image_url ? { url: embedData.image_url } : undefined,
      thumbnail: embedData.thumbnail_url
        ? { url: embedData.thumbnail_url }
        : undefined,
      title: embedData.title,
      url: embedData.url ? embedData.url : undefined,
    });

    await postChannel.send({ embeds: [embedMessage] });
    await interaction.followUp("Embed Sent!");
  },
};

export default command;
