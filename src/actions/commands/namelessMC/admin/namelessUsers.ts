import Redis from "#libs/Redis.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import getNamelessUserAvatar from "#utils/getNamelessUserAvatar.js";
import { createPageButtons, getPageData } from "#utils/getPageData.js";
import {
  ActionRowBuilder,
  Colors,
  ComponentType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";

const command: CommandType = {
  name: "nameless-users",
  description: "Get a list of all the users registered in your website.",
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write("Fetching data...");

    const redisResult = await Redis.get("namelessmc-users");

    let users: any[] = [];

    if (redisResult) users = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + "/users&limit=0",
        {
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
        }
      );

      debugStream.write(`Response Status: ${response.status}`);

      debugStream.write("Getting JSON data...");
      const responseData = await response.json();

      if (responseData.error)
        throw new Error(
          `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
            responseData.message ? "Message :" + responseData.message : ""
          }, ${responseData.meta ? "Meta :" + responseData.meta : ""}`
        );

      users = responseData.users;

      await Redis.set("namelessmc-users", JSON.stringify(users), {
        EX: 60,
      });
    }

    if (!users.length) {
      debugStream.write("No users recorded! Sending reply...");
      await interaction.followUp("No users are registered on the website.");
      debugStream.write("Reply sent!");
      return;
    }

    debugStream.write("Data collected! Creating embed...");

    const firstUser = users[0];

    const embedMessage = createEmbed({
      title: firstUser.username,
      color: Colors.DarkGold,
      thumbnail: {
        url: await getNamelessUserAvatar(firstUser.id),
      },
      fields: getFields(firstUser),
    });

    debugStream.write("Embed created! Creating components...");

    const buttonIds = [
      "nameless-users-previous-end-collector",
      "nameless-users-previous-collector",
      "nameless-users-pages-collector",
      "nameless-users-next-collector",
      "nameless-users-next-end-collector",
    ];

    const selectMenu = new StringSelectMenuBuilder({
      customId: "nameless-users-filter-collector",
      options: [
        {
          label: "All",
          value: "all",
          emoji: "👥",
          description: "Gets a list of all the users.",
        },
        {
          label: "Banned",
          value: "banned",
          emoji: "⚖",
          description: "Filters users that are banned.",
        },
        {
          label: "Verified",
          value: "verified",
          emoji: "✔",
          description: "Filters users that are verified.",
        },
        {
          label: "Discord Linked",
          value: "discord_linked",
          emoji: "🔗",
          description: "Filters users that have there discord accounts linked.",
        },
      ],
      placeholder: "Filter users by...",
      disabled: users.length === 1,
    });

    const firstActionRow = createPageButtons(buttonIds, users);
    const secondActionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [selectMenu],
    });

    debugStream.write("Components created! Sending message...");

    const followUpMsg = await interaction.followUp({
      embeds: [embedMessage],
      components: [firstActionRow, secondActionRow],
    });

    debugStream.write("Message sent!");

    if (users.length === 1) return;

    debugStream.write("Creating collectors...");

    let userData = users;
    let pageIndex = 0;

    const buttonCollector = followUpMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
    });

    const selectMenuCollector = followUpMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.StringSelect,
    });

    buttonCollector.on("collect", async (i) => {
      const result = getPageData(
        userData,
        pageIndex,
        i.customId,
        firstActionRow
      );

      pageIndex = result.currentPageIndex;
      const user = result.data;

      embedMessage.setFields(getFields(user));

      await i.update({
        embeds: [embedMessage],
        components:
          users.length === 1
            ? [firstActionRow]
            : [firstActionRow, secondActionRow],
      });
    });

    const [firstPageBtn, previousBtn, pagesBtn, nextBtn, lastPageBtn] =
      firstActionRow.components;

    selectMenuCollector.on("collect", async (i) => {
      const filter = i.values[0];

      switch (filter) {
        case "all":
          userData = users;
          break;
        case "banned":
          userData = users.filter((user: any) => user.banned);
          break;
        case "verified":
          userData = users.filter((user: any) => user.verified);
          break;
        case "discord_linked":
          userData = users.filter((user: any) =>
            user.integrations.find(
              ({ integration, verified }: any) =>
                integration === "Discord" && verified
            )
          );
          break;
      }

      if (!userData.length) {
        await i.followUp("There are no users under this category.");
        return;
      }

      pageIndex = 0;

      firstPageBtn.setDisabled(true);
      previousBtn.setDisabled(true);

      pagesBtn.setLabel(`Page 1 of ${userData.length}`);

      nextBtn.setDisabled(userData.length === 1);
      lastPageBtn.setDisabled(userData.length === 1);

      const user = userData[0];

      embedMessage.setFields(getFields(user));

      await i.update({
        embeds: [embedMessage],
        components: [firstActionRow, secondActionRow],
      });
    });

    debugStream.write("Collectors created!");
  },
};

function getFields(user: any) {
  return [
    { name: "User ID:", value: `\`${user.id}\``, inline: true },
    { name: "Banned:", value: user.banned ? "✔" : "❌", inline: true },
    { name: "Verified:", value: user.verified ? "✔" : "❌", inline: true },
    {
      name: "Integrations:",
      value:
        user.integrations
          .filter((integration: any) => integration.verified)
          .map(
            ({ integration, username }: any) =>
              `${integration}: \`${username}\``
          )
          .join("\n") || "N/A",
      inline: true,
    },
  ];
}

export default command;
