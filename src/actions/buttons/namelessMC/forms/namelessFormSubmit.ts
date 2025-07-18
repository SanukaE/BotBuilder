import { NamelessMCFormFields } from "#utils/enums.js";
import Redis from "#libs/Redis.js";
import ButtonType from "#types/ButtonType.js";
import createEmbed from "#utils/createEmbed.js";
import { createPageButtons, getPageData } from "#utils/getPageData.js";
import {
  ActionRowBuilder,
  Attachment,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

type FieldType = {
  id: number;
  name: string;
  type: NamelessMCFormFields;
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
  customID: "nameless-forms-discord-submit", //nameless-forms-discord-submit-${formID}

  async script(_, interaction, debugStream) {
    debugStream.write("Checking if users DM's are enable...");

    const dmChannel = await interaction.user.createDM();

    if (!dmChannel.isSendable()) {
      debugStream.write("User's DM's are not open. Letting the user know...");
      await interaction.editReply(
        "🔒 For privacy reasons, you can only fill in the form via DM's. Please enable your DM's and try again. 😊"
      );
      debugStream.write("Message sent!");
      return;
    } else {
      await interaction.followUp(
        "Please check your DM's. I will be sending the form questions over there soon..."
      );

      await dmChannel.sendTyping();
    }

    debugStream.write("DM's open! Getting data from interaction...");

    const formID = interaction.customId.split("-")[4];

    debugStream.write(`formID: ${formID}`);

    debugStream.write("Fetching data...");

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

      debugStream.write("Getting JSON data...");
      const responseData = await response.json();

      if (responseData.error)
        throw new Error(
          `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
            responseData.message ? "Message :" + responseData.message : ""
          }, ${responseData.meta ? "Meta :" + responseData.meta : ""}`
        );

      form = responseData;

      await Redis.set(`namelessmc-form-${formID}`, JSON.stringify(form), {
        EX: 60,
      });
    }

    debugStream.write("Data collected! Creating questions...");

    let questions: QuestionType[] = [];

    for (const field of form.fields as FieldType[]) {
      let builder: ModalBuilder | StringSelectMenuBuilder | undefined;
      let isModal = false;
      let isStringMenu = false;

      switch (field.type as NamelessMCFormFields) {
        case NamelessMCFormFields.TEXT:
        case NamelessMCFormFields.TEXT_AREA:
        case NamelessMCFormFields.EMAIL_ADDRESS:
          builder = createModal(`${form.title}`, form.id, field);
          isModal = true;
          break;

        case NamelessMCFormFields.OPTIONS:
        case NamelessMCFormFields.RADIO_CHECKBOX:
        case NamelessMCFormFields.CHECKBOX:
          builder = createStringMenu(form.id, field);
          isStringMenu = true;
          break;

        case NamelessMCFormFields.BARRIER:
        case NamelessMCFormFields.HELP_BOX:
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
        inputButton.setLabel("Enter answer");

        inputActionRow.setComponents(inputButton as ButtonBuilder);
      } else if (isStringMenu) {
        inputActionRow.setComponents(builder as StringSelectMenuBuilder);
      } else {
        inputButton.setCustomId(`discord-form-submit-msg-${form.id}-collector`);
        inputButton.setLabel("Enter answer via message");
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

    debugStream.write("Questions created! Creating embed...");

    const firstQuestion = questions[0];

    const getEmbedFields = (questionData: QuestionType) => {
      return [
        {
          name: "Required:",
          value: questionData.field.required ? "✔" : "❌",
        },
        {
          name: "Your Answer:",
          value: questionData.answer
            ? typeof questionData.answer === "string"
              ? questionData.answer
              : questionData.answer.join(", ")
            : "You haven't answered yet!",
        },
      ];
    };

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: firstQuestion.field.name,
      description: firstQuestion.field.info || "No info available",
      url: form.url_full,
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split("/")[2]
        }&sz=128`,
      },
      fields: getEmbedFields(firstQuestion),
    });

    debugStream.write("Embed created! Creating components...");

    const pagesButtonIds = [
      `nameless-form-${form.id}-discord-submit-previous-end-collector`,
      `nameless-form-${form.id}-discord-submit-previous-collector`,
      `nameless-form-${form.id}-discord-submit-pages-collector`,
      `nameless-form-${form.id}-discord-submit-next-collector`,
      `nameless-form-${form.id}-discord-submit-next-end-collector`,
    ];

    const firstActionRow = createPageButtons(pagesButtonIds, questions);

    const submitFormBtn = new ButtonBuilder({
      customId: `discord-form-submit-${form.id}-collector`,
      disabled: true,
      label: "Submit Form",
      style: ButtonStyle.Success,
    });

    const cancelFormBtn = new ButtonBuilder({
      customId: `discord-form-submit-cancel-${form.id}-collector`,
      label: "Cancel Submission",
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

    debugStream.write("Questions sent! Creating collectors...");

    const pagesCollector = questionsMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        pagesButtonIds.includes(i.customId),
    });

    let currentPageIndex = 0;
    let questionData: QuestionType;

    pagesCollector.on("collect", async (i) => {
      const result = getPageData(
        questions,
        currentPageIndex,
        i.customId,
        firstActionRow
      );

      currentPageIndex = result.currentPageIndex;
      questionData = result.data;

      embedMessage.setTitle(questionData.field.name);
      embedMessage.setDescription(
        questionData.field.info || "No info available"
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

    submitBtnCollector.on("collect", async (i) => {
      await i.deferUpdate();

      if (!isFormSubmittable()) {
        await i.followUp({
          content: "Please answer to all of the required question.",
          flags: MessageFlags.Ephemeral,
        });
        submitFormBtn.setDisabled(true);
        return;
      }

      const response = await fetch(
        process.env.NAMELESSMC_API_URL +
          `/forms/form/${formID}/submissions/create`,
        {
          method: "POST",
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
            responseData.message ? "Message :" + responseData.message : ""
          }, ${responseData.meta ? "Meta :" + responseData.meta : ""}\`\`\``,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      closeListeners("Form submitted");

      await i.followUp({
        content: `🎉 Your form submission (\`${responseData.submission_id}\`) was successfully submitted! [View Submission](${responseData.link}) (Note: You might not have permission to view your own submission.)`,
        flags: MessageFlags.Ephemeral,
      });

      await questionsMsg.delete();
    });

    const cancelBtnCollector = questionsMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === `discord-form-submit-cancel-${form.id}-collector`,
    });

    cancelBtnCollector.on("collect", async (i) => {
      await i.deferUpdate();

      closeListeners("Submission was canceled");

      await i.followUp({
        content: "The form was canceled!",
        flags: MessageFlags.Ephemeral,
      });

      await questionsMsg.delete();
    });

    const stringMenuCollector = questionsMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === interaction.user.id,
    });

    stringMenuCollector.on("collect", async (i) => {
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

    modalBtnCollector.on("collect", async (i) => {
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
          content: "No answer was provided.",
          flags: MessageFlags.Ephemeral,
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

    messageCollector.on("collect", async (message) => {
      const questionData = questions[currentPageIndex];

      let isNumberInput = false;
      let isFileInput = false;

      switch (questionData.field.type as NamelessMCFormFields) {
        case NamelessMCFormFields.FILE:
          isFileInput = true;
          break;

        case NamelessMCFormFields.NUMBER:
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
          await sendErrorMsg("Please enter a valid number. Try again!");
          return;
        }

        questions[currentPageIndex].answer = data.toString();
      } else if (isFileInput && message.attachments.size > 0) {
        const attachments = Array.from(message.attachments.values());
        const validAttachments = attachments.filter((attachment) =>
          attachment.contentType?.includes("image")
        );

        if (!validAttachments.length) {
          await sendErrorMsg("Please send a valid image file. Try again!");
          return;
        }

        data = validAttachments[0];

        const imageResponse = await fetch(data.url || data.proxyURL);
        const blob = await imageResponse.arrayBuffer();
        const image = `data:${imageResponse.headers.get(
          "content-type"
        )};base64,${Buffer.from(blob).toString("base64")}`;

        questions[currentPageIndex].answer = `[${data.name}](${data.url})`;
        questions[currentPageIndex].fileURI = image;
      } else {
        await sendErrorMsg("Please upload a valid image file. Try again!");
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
    placeholder: field.placeholder || "",
    required: field.required,
    style:
      field.type === NamelessMCFormFields.TEXT ||
      field.type === NamelessMCFormFields.EMAIL_ADDRESS
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

  switch (field.type as NamelessMCFormFields) {
    case NamelessMCFormFields.CHECKBOX:
      minValues = 0;
      maxValues = fieldOptions.length;
      break;

    case NamelessMCFormFields.OPTIONS:
    case NamelessMCFormFields.RADIO_CHECKBOX:
      minValues = 1;
      maxValues = 1;
      break;

    default:
      minValues = 1;
      maxValues = 1;
  }

  const stringMenu = new StringSelectMenuBuilder({
    customId: `discord-form-submit-menu-${formID}-collector`,
    placeholder: field.placeholder || "Pick your answer",
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
