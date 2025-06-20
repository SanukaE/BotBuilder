import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Colors,
  ComponentType,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import getNamelessSuggestionData from '#utils/getNamelessSuggestionData.js';
import Gemini from '#libs/Gemini.js';
import { Schema, SchemaType } from '@google/generative-ai';
import getNamelessSuggestions from '#utils/getNamelessSuggestions.js';
import createTempDataFile from '#utils/createTempDataFile.js';
import getConfig from '#utils/getConfig.js';

const command: CommandType = {
  name: 'nameless-suggestion-create',
  description:
    'Create a suggestion & post it to the website. (must have discord linked)',
  isDevOnly: true,

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const username = interaction.user.username;

    debugStream.write(`username: ${username}`);

    const { verifySuggestion } = getConfig("namelessMC") as { verifySuggestion: boolean };

    debugStream.write('Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: 'Not set',
      description: 'Not set',
      fields: [{ name: 'Category:', value: 'Not set' }],
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[2]
        }&sz=128`,
      },
    });

    debugStream.write('Embed created! Creating components...');

    const suggestionCategories: { name: string; id: number }[] = (
      await getNamelessSuggestionData()
    ).categories;

    const categoryMenu = new StringSelectMenuBuilder({
      customId: 'nameless-suggestion-category-input-collector',
      placeholder: 'Pick a category',
      options: suggestionCategories.map((category) => ({
        label: category.name,
        value: category.id.toString(),
      })),
    });

    const categoryMenuRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [categoryMenu],
    });

    const editSuggestionBtn = new ButtonBuilder({
      customId: 'nameless-suggestion-edit-collector',
      emoji: '📝',
      label: 'Edit Suggestion',
      style: ButtonStyle.Primary,
    });

    const submitSuggestionBtn = new ButtonBuilder({
      customId: 'nameless-suggestion-submit-collector',
      disabled: true,
      emoji: '💡',
      label: 'Submit Suggestion',
      style: ButtonStyle.Success,
    });

    const submitBtnRow = new ActionRowBuilder<ButtonBuilder>({
      components: [editSuggestionBtn, submitSuggestionBtn],
    });

    debugStream.write('Components created! Sending reply...');

    const replyMsg = await interaction.editReply({
      embeds: [embedMessage],
      components: [categoryMenuRow, submitBtnRow],
    });

    debugStream.write('Reply sent! Creating collectors...');

    const editSuggestionBtnCollector = replyMsg.createMessageComponentCollector(
      {
        componentType: ComponentType.Button,
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === 'nameless-suggestion-edit-collector',
      }
    );

    const enabledSubmitBtn = () => {
      if (
        embedMessage.data.title !== 'Not set' &&
        embedMessage.data.description !== 'Not set' &&
        embedMessage.data.fields![0].value !== 'Not set'
      ) {
        submitSuggestionBtn.setDisabled(false);
      }
    };

    editSuggestionBtnCollector.on('collect', async (i) => {
      const suggestionModal = new ModalBuilder({
        customId: 'nameless-suggestion-modal-input-collector',
        title: 'New Suggestion',
      });

      const suggestionTitle = new TextInputBuilder({
        customId: 'nameless-suggestion-title-input',
        label: 'Title:',
        placeholder: 'Enter suggestion title',
        required: true,
        style: TextInputStyle.Short,
        value:
          embedMessage.data.title === 'Not set' ? '' : embedMessage.data.title,
      });

      const suggestionContent = new TextInputBuilder({
        customId: 'nameless-suggestion-content-input',
        label: 'Content:',
        placeholder: 'Enter suggestion Content',
        required: true,
        style: TextInputStyle.Paragraph,
        value:
          embedMessage.data.description === 'Not set'
            ? ''
            : embedMessage.data.description,
      });

      const firstRow = new ActionRowBuilder<TextInputBuilder>({
        components: [suggestionTitle],
      });
      const secondRow = new ActionRowBuilder<TextInputBuilder>({
        components: [suggestionContent],
      });

      suggestionModal.setComponents([firstRow, secondRow]);

      await i.showModal(suggestionModal);

      const modalResponse = await interaction.awaitModalSubmit({
        time: 0,
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === 'nameless-suggestion-modal-input-collector',
      });

      await modalResponse.deferUpdate();

      const newSuggestionTitle = modalResponse.fields.getTextInputValue(
        'nameless-suggestion-title-input'
      );
      const newSuggestionContent = modalResponse.fields.getTextInputValue(
        'nameless-suggestion-content-input'
      );

      embedMessage.setTitle(newSuggestionTitle);
      embedMessage.setDescription(newSuggestionContent);

      enabledSubmitBtn();

      await interaction.editReply({
        embeds: [embedMessage],
        components: [categoryMenuRow, submitBtnRow],
      });
    });

    let categoryID: number;

    const categoryMenuCollector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === 'nameless-suggestion-category-input-collector',
    });

    categoryMenuCollector.on('collect', async (i) => {
      const value = Number(i.values[0]);
      categoryID = value;

      embedMessage.setFields([
        {
          name: 'Category:',
          value: suggestionCategories.find((category) => category.id === value)!
            .name,
        },
      ]);

      enabledSubmitBtn();

      await i.update({
        embeds: [embedMessage],
        components: [categoryMenuRow, submitBtnRow],
      });
    });

    const submitBtnCollector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === 'nameless-suggestion-submit-collector',
    });

    const submitSuggestion = async (i: ButtonInteraction) => {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + '/suggestions/create',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
          body: JSON.stringify({
            user: `integration_name:discord:${username}`,
            title: embedMessage.data.title,
            content: embedMessage.data.description,
            category: categoryID,
          }),
        }
      );

      const responseData = await response.json();

      if (responseData.error)
        throw new Error(
          `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
            responseData.message ? 'Message :' + responseData.message : ''
          }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
        );

      await interaction.editReply({
        content: `🎉 Your suggestion (\`${responseData.id}\`) was successfully submitted! [View Submission](${responseData.link})`,
        embeds: [],
        components: [],
      });
    };

    let hasSeenSimilarSuggestion = false; //Used to find out if the user has clicked on submit button again after seeing similar suggestion

    submitBtnCollector.on('collect', async (i) => {
      await i.deferUpdate();

      const gemini = Gemini();

      if (
        verifySuggestion &&
        gemini.enabled &&
        gemini.model &&
        gemini.fileManager &&
        !hasSeenSimilarSuggestion
      ) {
        const suggestionSchema: Schema = {
          type: SchemaType.OBJECT,
          description: 'The best matched suggestions ID.',
          example: { matchedFound: true, id: 1 },
          properties: {
            matchedFound: {
              type: SchemaType.BOOLEAN,
              description: 'Whether a match was found',
            },
            id: {
              type: SchemaType.NUMBER,
              description: 'The matched suggestion ID (0 if no match)',
            },
          },
          required: ['matchedFound', 'id'],
        };

        const suggestions = await getNamelessSuggestions();
        const openSuggestions = suggestions
          .filter((suggestion) => suggestion.status.open)
          .map((suggestion) => ({
            id: suggestion.id,
            title: suggestion.title,
            content: suggestion.content,
          }));

        createTempDataFile('suggestions.json', JSON.stringify(openSuggestions));

        const suggestionData = await gemini.fileManager.uploadFile(
          'temp/suggestions.json',
          {
            displayName: 'Suggestions',
            mimeType: 'text/json',
          }
        );

        gemini.model.generationConfig.responseMimeType = 'application/json';
        gemini.model.generationConfig.responseSchema = suggestionSchema;

        const result = await gemini.model.generateContent([
          {
            fileData: {
              mimeType: 'text/json',
              fileUri: suggestionData.file.uri,
            },
          },
          {
            text: `Is there a similar suggestion mentioned below already made? If yes return the matchedFound as true and the id of the suggestion. If no return matchedFound as false and id as 0.\n\nSuggestion:\nTitle: ${embedMessage.data.title}\nContent: ${embedMessage.data.description}`,
          },
        ]);

        const output = JSON.parse(result.response.text());

        if (output.matchedFound) {
          const suggestion = suggestions.find(
            (suggestion) => suggestion.id === output.id
          )!;

          const linkToSuggestion = new ButtonBuilder({
            emoji: '🔗',
            label: 'View Similar Suggestion',
            style: ButtonStyle.Link,
            url: suggestion.link,
          });

          hasSeenSimilarSuggestion = true;

          await i.followUp({
            content:
              'It looks like someone has already made a suggestion similar to yours. If you still would like to post your suggestion please click the button again.',
            components: [
              new ActionRowBuilder<ButtonBuilder>({
                components: [linkToSuggestion],
              }),
            ],
            ephemeral: true,
          });

          return;
        }
      }

      await submitSuggestion(i);

      categoryMenuCollector.stop('Suggestion was submitted');
      submitBtnCollector.stop('Suggestion was submitted');
      editSuggestionBtnCollector.stop('Suggestion was submitted');
    });

    debugStream.write('Collectors created!');
  },
};

export default command;
