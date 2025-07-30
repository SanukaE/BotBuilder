import Redis from "#libs/Redis.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import getNamelessSuggestionData from "#utils/getNamelessSuggestionData.js";
import getNamelessSuggestions from "#utils/getNamelessSuggestions.js";
import getNamelessUserAvatar from "#utils/getNamelessUserAvatar.js";
import getNamelessUserID from "#utils/getNamelessUserID.js";
import { createPageButtons, getPageData } from "#utils/getPageData.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Colors,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const command: CommandType = {
  name: "nameless-suggestions",
  description: "View all the suggestion made on the website.",

  async script(_, interaction, debugStream) {
    debugStream.write("Getting data from interaction...");

    const namelessUserID = await getNamelessUserID(interaction.user.username);

    debugStream.write(`namelessUserID: ${namelessUserID}`);

    debugStream.write("Fetching data...");

    const suggestions = await getNamelessSuggestions();

    if (!suggestions.length) {
      debugStream.write("No suggestions recorded! Sending message...");
      await interaction.editReply("No suggestions found!");
      debugStream.write("Message sent!");
      return;
    }

    debugStream.write("Data collected! Creating embed...");

    const firstSuggestion = suggestions[0];
    const suggestionEmbed = createEmbed({ color: Colors.DarkGold });

    const updateSuggestionEmbed = async (suggestionData: any) => {
      suggestionEmbed.setTitle(suggestionData.title);
      suggestionEmbed.setDescription(suggestionData.content);
      suggestionEmbed.setThumbnail(
        await getNamelessUserAvatar(suggestionData.author.id)
      );
      suggestionEmbed.setURL(suggestionData.author.link);
      suggestionEmbed.setFields([
        { name: "Author", value: suggestionData.author.username, inline: true },
        {
          name: "Created",
          value: `<t:${suggestionData.created}>`,
          inline: true,
        },
        { name: "Category", value: suggestionData.category.name, inline: true },
        {
          name: "Status",
          value: suggestionData.status.open ? "Open" : "Closed",
          inline: true,
        },
        {
          name: "Last Updated By",
          value: suggestionData.updated_by.username,
          inline: true,
        },
        {
          name: "Views",
          value: suggestionData.views.toString(),
          inline: true,
        },
        {
          name: "Likes",
          value: suggestionData.likes_count.toString(),
          inline: true,
        },
        {
          name: "Dislikes",
          value: suggestionData.dislikes_count.toString(),
          inline: true,
        },
      ]);
    };

    await updateSuggestionEmbed(firstSuggestion);

    debugStream.write("Embed created! Creating components...");

    const pageBtnIds = [
      `nameless-suggestions-previous-end-collector`,
      `nameless-suggestions-previous-collector`,
      `nameless-suggestions-pages-collector`,
      `nameless-suggestions-next-collector`,
      `nameless-suggestions-next-end-collector`,
    ];

    const firstActionRow = createPageButtons(pageBtnIds, suggestions);

    const likeBtn = new ButtonBuilder({
      customId: `nameless-suggestion-like-${firstSuggestion.id}-collector`,
      emoji: "👍",
      style: firstSuggestion.likes.includes(namelessUserID.valueOf())
        ? ButtonStyle.Success
        : ButtonStyle.Secondary,
    });

    const dislikeBtn = new ButtonBuilder({
      customId: `nameless-suggestion-dislike-${firstSuggestion.id}-collector`,
      emoji: "👎",
      style: firstSuggestion.dislikes.includes(namelessUserID.valueOf())
        ? ButtonStyle.Danger
        : ButtonStyle.Secondary,
    });

    const commentBtn = new ButtonBuilder({
      customId: `nameless-suggestion-comment-${firstSuggestion.id}-collector`,
      label: "Comment",
      emoji: "💬",
      style: ButtonStyle.Primary,
      disabled: !firstSuggestion.status.open,
    });

    const secondActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [likeBtn, dislikeBtn, commentBtn],
    });

    const suggestionData = await getNamelessSuggestionData();

    const categoryFilter = new StringSelectMenuBuilder({
      customId: `nameless-suggestions-category-filter-collector`,
      placeholder: "Filter by Category",
      options: [
        { label: "All", value: "0" },
        ...suggestionData.categories.map((category: any) => ({
          label: category.name,
          value: category.id.toString(),
        })),
      ],
      disabled: suggestionData.categories.length === 1,
    });

    const statusFilter = new StringSelectMenuBuilder({
      customId: `nameless-suggestions-status-filter-collector`,
      placeholder: "Filter by Status",
      options: [
        { label: "All", value: "0" },
        ...suggestionData.status.map((status: any) => ({
          label: status.name,
          value: status.id.toString(),
        })),
      ],
      disabled: suggestionData.status.length === 1,
    });

    const thirdActionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [categoryFilter],
    });

    const forthActionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [statusFilter],
    });

    debugStream.write("Components created! Sending follow up...");

    const followUpMsg = await interaction.followUp({
      embeds: [suggestionEmbed],
      components: [
        firstActionRow,
        secondActionRow,
        thirdActionRow,
        forthActionRow,
      ],
    });

    debugStream.write("Follow up sent!");

    if (suggestions.length === 1) return;

    debugStream.write("Creating collectors...");

    const pagesCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id && pageBtnIds.includes(i.customId),
    });

    let currentPage = 0;
    let data = suggestions;

    const updateButtonIds = (suggestion: any) => {
      likeBtn.setCustomId(
        `nameless-suggestion-like-${suggestion.id}-collector`
      );
      dislikeBtn.setCustomId(
        `nameless-suggestion-dislike-${suggestion.id}-collector`
      );
      commentBtn.setCustomId(
        `nameless-suggestion-comment-${suggestion.id}-collector`
      );
    };

    pagesCollector.on("collect", async (i) => {
      const result = getPageData(data, currentPage, i.customId, firstActionRow);
      currentPage = result.currentPageIndex;

      const currentSuggestion = result.data;

      await updateSuggestionEmbed(currentSuggestion);

      updateButtonIds(currentSuggestion);

      likeBtn.setStyle(
        currentSuggestion.likes.includes(namelessUserID.valueOf())
          ? ButtonStyle.Success
          : ButtonStyle.Secondary
      );

      dislikeBtn.setStyle(
        currentSuggestion.dislikes.includes(namelessUserID.valueOf())
          ? ButtonStyle.Danger
          : ButtonStyle.Secondary
      );

      commentBtn.setDisabled(!currentSuggestion.status.open);

      await i.update({
        embeds: [suggestionEmbed],
        components: [
          firstActionRow,
          secondActionRow,
          thirdActionRow,
          forthActionRow,
        ],
      });
    });

    const handleVote = async (i: ButtonInteraction) => {
      const suggestionID = parseInt(i.customId.split("-")[3]);
      const vote = i.customId.split("-")[2] as "like" | "dislike";
      const currentSuggestion = suggestions.find((s) => s.id === suggestionID)!;

      const hasVoted =
        vote === "like"
          ? currentSuggestion.likes.includes(namelessUserID.valueOf())
          : currentSuggestion.dislikes.includes(namelessUserID.valueOf());

      const response = await fetch(
        process.env.NAMELESSMC_API_URL + `/suggestions/${suggestionID}/${vote}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
          body: JSON.stringify({
            user: `integration_name:discord:${i.user.username}`,
            like: !hasVoted,
          }),
        }
      );

      const responseData = await response.json();

      if (responseData.error) {
        await i.followUp({
          content: `Failed to fetch from NamelessMC. Error: ${
            responseData.error
          }, ${
            responseData.message ? "Message :" + responseData.message : ""
          }, ${responseData.meta ? "Meta :" + responseData.meta : ""}`,
        });
        return;
      }

      if (hasVoted) {
        if (vote === "like") {
          currentSuggestion.likes = currentSuggestion.likes.filter(
            (id) => id !== namelessUserID.valueOf()
          );
          currentSuggestion.likes_count--;
        } else {
          currentSuggestion.dislikes = currentSuggestion.dislikes.filter(
            (id) => id !== namelessUserID.valueOf()
          );
          currentSuggestion.dislikes_count--;
        }
      } else {
        if (vote === "like") {
          currentSuggestion.likes.push(namelessUserID.valueOf());
          currentSuggestion.likes_count++;

          if (currentSuggestion.dislikes.includes(namelessUserID.valueOf())) {
            currentSuggestion.dislikes = currentSuggestion.dislikes.filter(
              (id) => id !== namelessUserID.valueOf()
            );
            currentSuggestion.dislikes_count--;
          }
        } else {
          currentSuggestion.dislikes.push(namelessUserID.valueOf());
          currentSuggestion.dislikes_count++;

          if (currentSuggestion.likes.includes(namelessUserID.valueOf())) {
            currentSuggestion.likes = currentSuggestion.likes.filter(
              (id) => id !== namelessUserID.valueOf()
            );
            currentSuggestion.likes_count--;
          }
        }
      }

      await updateSuggestionEmbed(currentSuggestion);

      updateButtonIds(currentSuggestion);

      likeBtn.setStyle(
        currentSuggestion.likes.includes(namelessUserID.valueOf())
          ? ButtonStyle.Success
          : ButtonStyle.Secondary
      );

      dislikeBtn.setStyle(
        currentSuggestion.dislikes.includes(namelessUserID.valueOf())
          ? ButtonStyle.Danger
          : ButtonStyle.Secondary
      );

      suggestions[currentPage] = currentSuggestion;

      await Redis.set("namelessmc-suggestions", JSON.stringify(suggestions), {
        EX: 60,
      });
      await Redis.set(
        `namelessmc-suggestion-${suggestionID}`,
        JSON.stringify(currentSuggestion),
        {
          EX: 60,
        }
      );

      await i.update({
        embeds: [suggestionEmbed],
        components: [
          firstActionRow,
          secondActionRow,
          thirdActionRow,
          forthActionRow,
        ],
      });
    };

    const likeCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith("nameless-suggestion-like"),
    });

    likeCollector.on("collect", async (i) => await handleVote(i));

    const dislikeCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith("nameless-suggestion-dislike"),
    });

    dislikeCollector.on("collect", async (i) => await handleVote(i));

    const commentBtnCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith("nameless-suggestion-comment"),
    });

    commentBtnCollector.on("collect", async (i) => {
      const suggestionID = parseInt(i.customId.split("-")[3]);
      const suggestion = suggestions.find(
        (suggestion) => suggestion.id === suggestionID
      )!;

      const commentModal = new ModalBuilder({
        customId: `nameless-suggestion-comment-modal-collector`,
        title: `Comment on ${suggestion.title}`,
      });

      const commentTextInput = new TextInputBuilder({
        customId: `nameless-suggestion-comment-input-collector`,
        label: "New comment:",
        placeholder: "Enter your comment here...",
        required: true,
        style: TextInputStyle.Paragraph,
      });

      const firstQuestion = new ActionRowBuilder<TextInputBuilder>({
        components: [commentTextInput],
      });

      commentModal.setComponents(firstQuestion);

      await i.showModal(commentModal);

      const modalResponse = await i.awaitModalSubmit({
        time: 0,
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === `nameless-suggestion-comment-modal-collector`,
      });

      modalResponse.deferUpdate();

      const comment = modalResponse.fields.getTextInputValue(
        "nameless-suggestion-comment-input-collector"
      );

      const response = await fetch(
        process.env.NAMELESSMC_API_URL + `/suggestions/${suggestionID}/comment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
          body: JSON.stringify({
            user: `integration_name:discord:${i.user.username}`,
            content: comment,
          }),
        }
      );

      const responseData = await response.json();

      if (responseData.error) {
        await modalResponse.followUp({
          content: `Failed to fetch from NamelessMC. Error: ${
            responseData.error
          }, ${
            responseData.message ? "Message :" + responseData.message : ""
          }, ${responseData.meta ? "Meta :" + responseData.meta : ""}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await modalResponse.followUp({
        content: `Comment added!`,
        flags: MessageFlags.Ephemeral,
      });
    });

    let categoryID = 0; //0: All
    let statusID = 0; //0: All

    const handleFilter = async (i: StringSelectMenuInteraction) => {
      const filterID = parseInt(i.values[0]);
      const filterType = i.customId.split("-")[2] as "category" | "status";

      if (filterType === "category") categoryID = filterID;
      else statusID = filterID;

      data = suggestions.filter(
        (suggestion) =>
          (categoryID ? suggestion.category.id === categoryID : true) &&
          (statusID ? suggestion.status.id === statusID : true)
      );

      currentPage = 0;

      const currentSuggestion = data[currentPage];

      await updateSuggestionEmbed(currentSuggestion);

      updateButtonIds(currentSuggestion);

      likeBtn.setStyle(
        currentSuggestion.likes.includes(namelessUserID.valueOf())
          ? ButtonStyle.Success
          : ButtonStyle.Secondary
      );

      dislikeBtn.setStyle(
        currentSuggestion.dislikes.includes(namelessUserID.valueOf())
          ? ButtonStyle.Danger
          : ButtonStyle.Secondary
      );

      commentBtn.setDisabled(!currentSuggestion.status.open);

      const [firstPageBtn, previousBtn, pagesBtn, nextBtn, lastPageBtn] =
        firstActionRow.components;

      firstPageBtn.setDisabled(true);
      previousBtn.setDisabled(true);

      pagesBtn.setLabel(`Page ${currentPage + 1} of ${data.length}`);

      nextBtn.setDisabled(data.length === 1);
      lastPageBtn.setDisabled(data.length === 1);

      await i.update({
        embeds: [suggestionEmbed],
        components: [
          firstActionRow,
          secondActionRow,
          thirdActionRow,
          forthActionRow,
        ],
      });
    };

    const categoryFilterCollector = followUpMsg.createMessageComponentCollector(
      {
        componentType: ComponentType.StringSelect,
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === "nameless-suggestions-category-filter-collector",
      }
    );

    categoryFilterCollector.on("collect", async (i) => await handleFilter(i));

    const statusFilterCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === "nameless-suggestions-status-filter-collector",
    });

    statusFilterCollector.on("collect", async (i) => await handleFilter(i));

    debugStream.write("Collectors created!");
  },
};

export default command;
