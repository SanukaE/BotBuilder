import Redis from '#libs/Redis.js';
import ButtonType from '#types/ButtonType.js';
import createEmbed from '#utils/createEmbed.js';
import getEmbedPageData from '#utils/getEmbedPageData.js';
import {
  ActionRowBuilder,
  Attachment,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

enum FieldTypes {
  TEXT = 1,
  OPTIONS,
  TEXT_AREA,
  HELP_BOX,
  BARRIER,
  NUMBER,
  EMAIL_ADDRESS,
  RADIO_CHECKBOX,
  CHECKBOX,
  FILE,
}

type FieldType = {
  id: number;
  name: string;
  type: FieldTypes;
  required: boolean;
  min: number;
  max: number;
  placeholder: string | null;
  options: string[];
  info: string | null;
};

type QuestionType = {
  field: FieldType;
  answer?: string | string[];
  fileURI?: string;
  builder: ModalBuilder | StringSelectMenuBuilder | undefined;
  inputActionRow: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;
};

const button: ButtonType = {
  customID: 'nameless-forms-discord-submit', //nameless-forms-discord-submit-${formID}

  async script(_, interaction, debugStream) {
    debugStream.write("Checking if users DM's are enable...");

    const dmChannel = await interaction.user.createDM();

    if (!dmChannel.isSendable()) {
      debugStream.write("User's DM's are not open. Letting the user know...");
      await interaction.editReply(
        "🔒 For privacy reasons, you can only fill in the form via DM's. Please enable your DM's and try again. 😊"
      );
      debugStream.write('Message sent!');
      return;
    } else {
      await interaction.followUp(
        "Please check your DM's. I will be sending the form questions over there soon..."
      );

      await dmChannel.sendTyping();
    }

    debugStream.write("DM's open! Getting data from interaction...");

    const formID = interaction.customId.split('-')[4];

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
        EX: 60_000,
      });
    }

    debugStream.write('Data collected! Creating questions...');

    let questions: QuestionType[] = [];

    for (const field of form.fields as FieldType[]) {
      let builder: ModalBuilder | StringSelectMenuBuilder | undefined;
      let isModal = false;
      let isStringMenu = false;

      switch (field.type as FieldTypes) {
        case FieldTypes.TEXT:
        case FieldTypes.TEXT_AREA:
        case FieldTypes.EMAIL_ADDRESS:
          builder = createModal(`${form.title}`, form.id, field);
          isModal = true;
          break;

        case FieldTypes.OPTIONS:
        case FieldTypes.RADIO_CHECKBOX:
        case FieldTypes.CHECKBOX:
          builder = createStringMenu(form.id, field);
          isStringMenu = true;
          break;

        case FieldTypes.BARRIER:
        case FieldTypes.HELP_BOX:
          continue;
      }

      const inputButton = new ButtonBuilder({ style: ButtonStyle.Secondary });
      const inputActionRow = new ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >();

      if (isModal) {
        inputButton.setCustomId(
          `discord-form-submit-modal-${form.id}-collector`
        );
        inputButton.setLabel('Enter answer');

        inputActionRow.setComponents(inputButton as ButtonBuilder);
      } else if (isStringMenu) {
        inputActionRow.setComponents(builder as StringSelectMenuBuilder);
      } else {
        inputButton.setCustomId(`discord-form-submit-msg-${form.id}-collector`);
        inputButton.setLabel('Enter answer via message');
        inputButton.setDisabled(true);

        inputActionRow.setComponents(inputButton as ButtonBuilder);
      }

      questions.push({
        field,
        builder,
        inputActionRow,
        answer: field.options[0],
      });
    }

    debugStream.write('Questions created! Creating embed...');

    const firstQuestion = questions[0];

    const getEmbedFields = (questionData: QuestionType) => {
      return [
        {
          name: 'Required:',
          value: questionData.field.required ? '✔' : '❌',
        },
        {
          name: 'Your Answer:',
          value: questionData.answer
            ? typeof questionData.answer === 'string'
              ? questionData.answer
              : questionData.answer.join(', ')
            : "You haven't answered yet!",
        },
      ];
    };

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: firstQuestion.field.name,
      description: firstQuestion.field.info || 'No info available',
      url: form.url_full,
      thumbnail: { url: 'https://i.postimg.cc/Kz6WKb69/Nameless-MC-Logo.png' },
      fields: getEmbedFields(firstQuestion),
    });

    debugStream.write('Embed created! Creating components...');

    const pagesButtonIds = [
      `nameless-form-${form.id}-discord-submit-previous-collector`,
      `nameless-form-${form.id}-discord-submit-next-collector`,
    ];

    const previousBtn = new ButtonBuilder({
      customId: pagesButtonIds[0],
      disabled: true,
      emoji: '⬅',
      style: ButtonStyle.Primary,
    });

    const pagesBtn = new ButtonBuilder({
      customId: `nameless-form-${form.id}-discord-submit-pages-collector`,
      disabled: true,
      style: ButtonStyle.Secondary,
      label: `Pages 1 of ${questions.length}`,
    });

    const nextBtn = new ButtonBuilder({
      customId: pagesButtonIds[1],
      disabled: questions.length === 1,
      emoji: '➡',
      style: ButtonStyle.Primary,
    });

    const firstActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [previousBtn, pagesBtn, nextBtn],
    });

    const submitFormBtn = new ButtonBuilder({
      customId: `discord-form-submit-${form.id}-collector`,
      disabled: true,
      label: 'Submit Form',
      style: ButtonStyle.Success,
    });

    const cancelFormBtn = new ButtonBuilder({
      customId: `discord-form-submit-cancel-${form.id}-collector`,
      label: 'Cancel Submission',
      style: ButtonStyle.Danger,
    });

    //the second action row is question input (stringMenu/model submit)
    const thirdActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [submitFormBtn, cancelFormBtn],
    });

    debugStream.write("Components created! Sending form questions via DM's...");

    const questionsMsg = await dmChannel.send({
      embeds: [embedMessage],
      components: [
        firstActionRow,
        firstQuestion.inputActionRow,
        thirdActionRow,
      ],
    });

    debugStream.write('Questions sent! Creating collectors...');

    const pagesCollector = questionsMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        pagesButtonIds.includes(i.customId),
    });

    let currentPageIndex = 0;
    let questionData: QuestionType;

    pagesCollector.on('collect', async (i) => {
      const result = getEmbedPageData(
        questions,
        currentPageIndex,
        i.customId.split('-').includes('next'),
        firstActionRow
      );
      questionData = result.pageData;

      currentPageIndex = result.currentPageIndex;

      embedMessage.setTitle(questionData.field.name);
      embedMessage.setDescription(
        questionData.field.info || 'No info available'
      );
      embedMessage.setFields(getEmbedFields(questionData));

      await i.update({
        embeds: [embedMessage],
        components: [
          firstActionRow,
          questionData.inputActionRow,
          thirdActionRow,
        ],
      });
    });

    const isFormSubmittable = () => {
      return !questions.find(
        (question) => question.field.required && !question.answer
      );
    };

    const submitBtnCollector = questionsMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === `discord-form-submit-${form.id}-collector`,
    });

    const closeListeners = (reason: string) => {
      pagesCollector.stop(reason);
      submitBtnCollector.stop(reason);
      stringMenuCollector.stop(reason);
      modalBtnCollector.stop(reason);
      messageCollector.stop(reason);
    };

    submitBtnCollector.on('collect', async (i) => {
      await i.deferUpdate();

      if (!isFormSubmittable()) {
        await i.followUp({
          content: 'Please answer to all of the required question.',
          ephemeral: true,
        });
        submitFormBtn.setDisabled(true);
        return;
      }

      const response = await fetch(
        process.env.NAMELESSMC_API_URL +
          `/forms/form/${formID}/submissions/create`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
          body: JSON.stringify({
            user: `integration_name:discord:${i.user.username}`,
            field_values: questions
              .filter((q) => q.answer)
              .reduce(
                (acc, q) => ({
                  ...acc,
                  [q.field.id]: q.fileURI || q.answer!,
                }),
                {}
              ),
          }),
        }
      );

      const responseData = await response.json();

      if (responseData.error) {
        await i.followUp({
          content: `An error occurred: \`\`\`Failed to fetch from NamelessMC. Error: ${
            responseData.error
          }, ${
            responseData.message ? 'Message :' + responseData.message : ''
          }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}\`\`\``,
          ephemeral: true,
        });
        return;
      }

      closeListeners('Form submitted');

      await i.followUp({
        content: `🎉 Your form submission (\`${responseData.submission_id}\`) was successfully submitted! [View Submission](${responseData.link}) (Note: You might not have permission to view your own submission.)`,
        ephemeral: true,
      });

      await questionsMsg.delete();
    });

    const cancelBtnCollector = questionsMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === `discord-form-submit-cancel-${form.id}-collector`,
    });

    cancelBtnCollector.on('collect', async (i) => {
      await i.deferUpdate();

      closeListeners('Submission was canceled');

      await i.followUp({ content: 'The form was canceled!', ephemeral: true });

      await questionsMsg.delete();
    });

    const stringMenuCollector = questionsMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === interaction.user.id,
    });

    stringMenuCollector.on('collect', async (i) => {
      questions[currentPageIndex].answer = i.values;

      embedMessage.setFields(getEmbedFields(questions[currentPageIndex]));
      if (isFormSubmittable()) submitFormBtn.setDisabled(false);

      await i.update({
        embeds: [embedMessage],
        components: [
          firstActionRow,
          questions[currentPageIndex].inputActionRow,
          thirdActionRow,
        ],
      });
    });

    const modalBtnCollector = questionsMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === `discord-form-submit-modal-${form.id}-collector`,
    });

    modalBtnCollector.on('collect', async (i) => {
      await i.showModal(questions[currentPageIndex].builder as ModalBuilder);

      const modalResponse = await i.awaitModalSubmit({
        time: 0,
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === `discord-form-submit-modal-${formID}-collector`,
      });

      await modalResponse.deferUpdate();

      const answer = modalResponse.fields.getTextInputValue(
        `discord-form-submit-text-${formID}`
      );

      if (!answer) {
        await modalResponse.followUp({
          content: 'No answer was provided.',
          ephemeral: true,
        });
        return;
      }

      questions[currentPageIndex].answer = answer;

      embedMessage.setFields(getEmbedFields(questions[currentPageIndex]));
      if (isFormSubmittable()) submitFormBtn.setDisabled(false);

      await questionsMsg.edit({
        embeds: [embedMessage],
        components: [
          firstActionRow,
          questions[currentPageIndex].inputActionRow,
          thirdActionRow,
        ],
      });
    });

    const messageCollector = dmChannel.createMessageCollector({
      filter: (msg) => msg.author.id === interaction.user.id,
    });

    messageCollector.on('collect', async (message) => {
      const questionData = questions[currentPageIndex];

      let isNumberInput = false;
      let isFileInput = false;

      switch (questionData.field.type as FieldTypes) {
        case FieldTypes.FILE:
          isFileInput = true;
          break;

        case FieldTypes.NUMBER:
          isNumberInput = true;
          break;

        default:
          return;
      }

      let data: number | Attachment;

      const sendErrorMsg = async (text: string) => {
        await dmChannel.sendTyping();
        const errorMsg = await message.reply(text);
        setTimeout(async () => await errorMsg.delete(), 10_000); //10 sec
      };

      if (isNumberInput) {
        data = Number(message.content);

        if (isNaN(data)) {
          await sendErrorMsg('Please enter a valid number. Try again!');
          return;
        }

        questions[currentPageIndex].answer = data.toString();
      } else if (isFileInput && message.attachments.size > 0) {
        const attachments = Array.from(message.attachments.values());
        const validAttachments = attachments.filter((attachment) =>
          attachment.contentType?.includes('image')
        );

        if (!validAttachments.length) {
          await sendErrorMsg('Please send a valid image file. Try again!');
          return;
        }

        data = validAttachments[0];

        const imageResponse = await fetch(data.url || data.proxyURL);
        const blob = await imageResponse.arrayBuffer();
        const image = `data:${imageResponse.headers.get(
          'content-type'
        )};base64,${Buffer.from(blob).toString('base64')}`;

        questions[currentPageIndex].answer = `[${data.name}](${data.url})`;
        questions[currentPageIndex].fileURI = image;
      } else {
        await sendErrorMsg('Please upload a valid image file. Try again!');
        return;
      }

      embedMessage.setFields(getEmbedFields(questions[currentPageIndex]));
      if (isFormSubmittable()) submitFormBtn.setDisabled(false);

      await questionsMsg.edit({
        embeds: [embedMessage],
        components: [
          firstActionRow,
          questions[currentPageIndex].inputActionRow,
          thirdActionRow,
        ],
      });
    });
  },
};

function createModal(title: string, formID: string, field: any) {
  const textInputModal = new ModalBuilder({
    customId: `discord-form-submit-modal-${formID}-collector`,
    title: title,
  });

  const textInput = new TextInputBuilder({
    customId: `discord-form-submit-text-${formID}`,
    label: field.name,
    maxLength: field.max || 4000,
    minLength: field.min,
    placeholder: field.placeholder || '',
    required: field.required,
    style:
      field.type === FieldTypes.TEXT || field.type === FieldTypes.EMAIL_ADDRESS
        ? TextInputStyle.Short
        : TextInputStyle.Paragraph,
  });

  const inputRow = new ActionRowBuilder<TextInputBuilder>({
    components: [textInput],
  });

  textInputModal.addComponents(inputRow);

  return textInputModal;
}

function createStringMenu(formID: string, field: any) {
  const fieldOptions: string[] = field.options;

  let minValues: number;
  let maxValues: number;

  switch (field.type as FieldTypes) {
    case FieldTypes.CHECKBOX:
      minValues = 0;
      maxValues = fieldOptions.length;
      break;

    case FieldTypes.OPTIONS:
    case FieldTypes.RADIO_CHECKBOX:
      minValues = 1;
      maxValues = 1;
      break;

    default:
      minValues = 1;
      maxValues = 1;
  }

  const stringMenu = new StringSelectMenuBuilder({
    customId: `discord-form-submit-menu-${formID}-collector`,
    placeholder: field.placeholder || 'Pick your answer',
    options: fieldOptions.map((option) => ({
      label: option,
      value: option,
    })),
    minValues,
    maxValues,
  });

  return stringMenu;
}

export default button;
