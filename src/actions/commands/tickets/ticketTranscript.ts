import CommandType from "#types/CommandType.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  PermissionFlagsBits,
} from "discord.js";
import getConfig from "#utils/getConfig.js";
import getAllFiles from "#utils/getAllFiles.js";
import path from "path";
import fs from "fs";
import createEmbed from "#utils/createEmbed.js";
import Gemini from "#libs/Gemini.js";
import { createPageButtons, getPageData } from "#utils/getPageData.js";

const supportConfig = getConfig("support") as any;

const command: CommandType = {
  name: "ticket-transcript",
  description: "Get all the available transcripts of a users ticket.",
  options: [
    {
      name: "user",
      description: "The user to get the transcripts for.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "category",
      description: "The category of the transcript to get.",
      type: ApplicationCommandOptionType.String,
      choices: supportConfig.ticketCategories.map((cat: string) => {
        const [categoryName] = cat.split(":");
        return {
          name: categoryName,
          value: categoryName,
        };
      }),
      required: true,
    },
  ],
  isDisabled: !supportConfig.enableTicketSystem,
  permissions: [PermissionFlagsBits.Administrator],

  async script(client, interaction, debugStream) {
    const user = interaction.options.getUser("user", true);
    const category = interaction.options.getString("category", true);

    if (user.bot) {
      await interaction.editReply("You cannot get transcripts for a bot user.");
      return;
    }

    const transcriptCategoryPath = path.join(
      process.cwd(),
      "localData",
      "ticketTranscripts",
      category
    );
    const transcriptFiles = getAllFiles(transcriptCategoryPath).filter((file) =>
      file.includes(user.username)
    );

    if (transcriptFiles.length === 0) {
      await interaction.editReply(
        `No transcripts found for ${user.username} in the category ${category}.`
      );
      return;
    }

    const fileData = transcriptFiles.map((file) => {
      const ticketContent = fs.readFileSync(file, "utf-8");
      const ticketSections = ticketContent.split("\n\n\n");

      let info = ticketSections[0]
        .replace("General Information", "")
        .trim()
        .split("\n");
      let summary = "No summary available.";

      if (Gemini().enabled)
        summary = ticketSections[2].replace("Ticket Summary", "").trim();

      const channelID =
        file.split("/").pop()?.split(".")[0].split("-").pop() || "unknown";
      const button = new ButtonBuilder({
        label: "View Transcript",
        style: ButtonStyle.Link,
        url: `http://${process.env.WEB_SERVER_IP}:${process.env.WEB_SERVER_PORT}/tickets/transcript/${channelID}`,
      });
      const viewButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        button
      );

      return {
        viewButton,
        summary,
        info,
      };
    });

    const firstFile = fileData[0];

    const embedMessage = createEmbed({
      title: `Transcripts for ${user.username}`,
      description: firstFile.summary,
      fields: firstFile.info.map((line) => {
        const [key, value] = line.split(": ");
        return { name: key || "Unknown", value: value || "N/A", inline: true };
      }),
      color: Colors.Blurple,
      thumbnail: { url: user.displayAvatarURL() },
    });

    const pageButtons = createPageButtons(
      [
        `ticket-transcript-first-collector`,
        `ticket-transcript-previous-collector`,
        `ticket-transcript-pages-collector`,
        `ticket-transcript-next-collector`,
        `ticket-transcript-last-collector`,
      ],
      fileData
    );

    if (fileData.length === 1)
      pageButtons.components.forEach((btn) => {
        btn.setDisabled(true);
      });

    const followUp = await interaction.followUp({
      embeds: [embedMessage],
      components: [pageButtons, firstFile.viewButton],
    });

    const collector = followUp.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
    });

    let currentPageIndex = 0;

    collector.on("collect", async (i) => {
      const result = getPageData(
        fileData,
        currentPageIndex,
        i.customId,
        pageButtons
      );

      currentPageIndex = result.currentPageIndex;
      const { viewButton, summary, info } = result.data;

      embedMessage.setDescription(summary);
      embedMessage.setFields(
        info.map((line: string) => {
          const [key, value] = line.split(": ");
          return {
            name: key || "Unknown",
            value: value || "N/A",
            inline: true,
          };
        })
      );

      await i.update({
        embeds: [embedMessage],
        components: [pageButtons, viewButton],
      });
    });
  },
};

export default command;
