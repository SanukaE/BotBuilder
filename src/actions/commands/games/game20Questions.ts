import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import getConfig from "#utils/getConfig.js";
import { Schema, Type } from "@google/genai";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Colors,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const gemini = Gemini();

const command: CommandType = {
  name: "game-20-questions",
  description:
    "I think of something, and you ask yes/no questions to guess what it is.",
  isDisabled: !gemini.enabled,

  async script(client, interaction, debugStream) {
    const { geminiModel } = getConfig("ai") as { geminiModel: string };

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        object: {
          type: Type.STRING,
          description: "I'm thinking of a ....",
        },
      },
      required: ["object"],
    };

    const aiResult = await gemini.model!.generateContent({
      model: geminiModel || "gemini-2.5-flash",
      contents: "Think of an object for a game of 20 questions.",
      config: {
        responseJsonSchema: responseSchema,
        responseMimeType: "application/json",
      },
    });

    if (!aiResult.text) throw new Error("Fail to think of an object");

    const object = JSON.parse(aiResult.text).object.toLowerCase().trim();

    const answerBtn = new ButtonBuilder({
      customId: `button-game-20-question-answer-collector`,
      emoji: "🤔",
      label: "Enter Guess",
      style: ButtonStyle.Success,
    });

    const askQuestionBtn = new ButtonBuilder({
      customId: `button-game-20-question-ask-collector`,
      emoji: "❓",
      label: "Ask Question",
      style: ButtonStyle.Secondary,
    });

    const giveUpBtn = new ButtonBuilder({
      customId: `button-game-20-question-giveup-collector`,
      emoji: "😢",
      label: "Give Up",
      style: ButtonStyle.Danger,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [answerBtn, askQuestionBtn, giveUpBtn],
    });

    const embedMessage = createEmbed({
      color: Colors.Navy,
      title: "20 Questions",
      description:
        "Guess the object I'm thinking of. You are allowed to ask a maximum of 20 questions. So ask away!",
      thumbnail: { url: "https://i.postimg.cc/8z4RsdFL/20-Questions.jpg" },
    });

    const followUpMsg = await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });
    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith("button-game-20-question-"),
    });

    collector.on("collect", async (i) => {
      //Game Over
      if (i.customId === "button-game-20-question-giveup-collector") {
        actionRow.components.forEach((button) => button.setDisabled(true));
        await i.update({
          content: `Game over! I was thinking of a \`${object}\`. That must have been a hard one I guess 🤔.`,
          embeds: [embedMessage],
          components: [actionRow],
        });
        collector.stop("Game Over!");
        return;
      }

      const modal = new ModalBuilder({
        customId: "modal-game-20-question-collector",
      });
      const textInput = new TextInputBuilder({
        customId: "text-game-20-question-value",
        required: true,
      });
      const inputRow = new ActionRowBuilder<TextInputBuilder>({
        components: [textInput],
      });

      const getUserInput = async (
        i: ButtonInteraction,
        placeholder: string,
        inputStyle: TextInputStyle
      ) => {
        inputRow.components.forEach((textInput) =>
          textInput
            .setLabel(`Your ${placeholder}`)
            .setPlaceholder(`Enter your ${placeholder.toLowerCase()} here...`)
            .setStyle(inputStyle)
        );
        modal
          .setTitle(`Enter your ${placeholder.toLowerCase()}`)
          .addComponents(inputRow);
        await i.showModal(modal);

        const modalSubmit = await i.awaitModalSubmit({
          time: 0,
          filter: (modalInteraction) =>
            modalInteraction.user.id === interaction.user.id &&
            modalInteraction.customId === "modal-game-20-question-collector",
        });

        const userAnswer = modalSubmit.fields.getTextInputValue(
          "text-game-20-question-value"
        );

        return { userAnswer, modalSubmit };
      };

      //New Question
      if (i.customId === "button-game-20-question-ask-collector") {
        const questions = embedMessage.data.fields?.length;
        const maxQuestions = 20;

        if (questions === maxQuestions) {
          await i.reply({
            content:
              "You have already asked 20 questions which is the maximum.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const { userAnswer: newQuestion, modalSubmit } = await getUserInput(
          i,
          "Question",
          TextInputStyle.Paragraph
        );

        const questionExist = embedMessage.data.fields?.find(
          (field) => field.name === newQuestion
        );

        if (questionExist) {
          await modalSubmit.reply({
            content: "This question has already been asked.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const responseSchema: Schema = {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.BOOLEAN,
              description: "Is the answer true or false",
            },
          },
          required: ["answer"],
        };

        const aiResult = await gemini.model!.generateContent({
          model: geminiModel || "gemini-2.5-flash",
          contents: `For a game of 20 question, the object is a \`${object}\`. Is the answer to this question "${newQuestion}" true or false related to the object?`,
          config: {
            responseJsonSchema: responseSchema,
            responseMimeType: "application/json",
          },
        });

        if (!aiResult.text) throw new Error("Failed to answer question");

        const isTrue: boolean = JSON.parse(aiResult.text).answer;

        embedMessage.addFields({
          name: newQuestion,
          value: isTrue ? "✅ Yes" : "❌ No",
        });
        const questionNo = embedMessage.data.fields!.length;

        if (questionNo === maxQuestions) askQuestionBtn.setDisabled(true);

        await modalSubmit.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.editReply({
          embeds: [embedMessage],
          components: [actionRow],
        });
        await modalSubmit.followUp({
          content: `Question added: "${newQuestion}" - ${
            isTrue ? "✅ Yes" : "❌ No"
          }`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      //Guess
      if (i.customId === "button-game-20-question-answer-collector") {
        const { userAnswer: newGuess, modalSubmit } = await getUserInput(
          i,
          "Guess",
          TextInputStyle.Short
        );

        const normalizedGuess = newGuess.toLowerCase().trim();

        if (normalizedGuess === object) {
          actionRow.components.forEach((button) => button.setDisabled(true));
          await modalSubmit.deferReply({ flags: MessageFlags.Ephemeral });
          await interaction.editReply({
            content: `🎉 **You Won!** the object I was thinking of was a \`${object}\`.`,
            embeds: [embedMessage],
            components: [actionRow],
          });
          await modalSubmit.followUp({
            content: "Congratulations! You guessed correctly! 🎉",
            flags: MessageFlags.Ephemeral,
          });
          collector.stop("Game Over!");
          return;
        }

        await modalSubmit.reply({
          content: "That's not what I'm thinking of, try again 💪.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    });
  },
};

export default command;
