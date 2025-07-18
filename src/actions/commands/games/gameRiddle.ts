import CommandType from "#types/CommandType.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const categories = [
  { name: "Science", value: "science" },
  { name: "Math", value: "math" },
  { name: "Mystery", value: "mystery" },
  { name: "Funny", value: "funny" },
  { name: "Logic", value: "logic" },
];

const command: CommandType = {
  name: "game-riddle",
  description: "Can you answer this riddle?",
  options: [
    {
      name: "category",
      description: "Category of the riddle",
      type: ApplicationCommandOptionType.String,
      choices: categories,
    },
  ],

  async script(client, interaction, debugStream) {
    const category =
      interaction.options.getString("category") ||
      categories[Math.floor(Math.random() * categories.length)].value;

    const baseURL = "https://riddles-api-eight.vercel.app/";
    const apiURL = baseURL + category;

    const response = await fetch(apiURL);
    if (!response.ok) throw new Error("Response was not ok");

    const riddleData = (await response.json()) as {
      riddle: string;
      answer: string;
      category: string;
    };

    const answerBtn = new ButtonBuilder({
      customId: "button-game-riddle-collector",
      label: "Enter Answer",
      style: ButtonStyle.Success,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [answerBtn],
    });

    const followUp = await interaction.followUp({
      content:
        riddleData.riddle +
        ` \`[Category: ${riddleData.category}]\`\n> ⏳ You have 5 min to answer!`,
      components: [actionRow],
      flags: MessageFlags.Ephemeral,
    });

    const collector = followUp.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === "button-game-riddle-collector",
      time: 5 * 60 * 1000, //5 min
    });

    let hasWon = false;

    collector.on("collect", async (i) => {
      const modal = new ModalBuilder({
        customId: "modal-game-riddle-collector",
        title: "Enter your answer",
      });

      const textInput = new TextInputBuilder({
        customId: "text-game-answer-riddle",
        label: "Your Answer",
        placeholder: "Enter your answer here...",
        style: TextInputStyle.Short,
        required: true,
      });

      const textActionRow = new ActionRowBuilder<TextInputBuilder>({
        components: [textInput],
      });
      modal.addComponents(textActionRow);

      await i.showModal(modal);

      const modalSubmit = await i.awaitModalSubmit({
        time: 0,
        filter: (modalInteraction) =>
          modalInteraction.user.id === interaction.user.id &&
          modalInteraction.customId === "modal-game-riddle-collector",
      });

      const userAnswer = modalSubmit.fields.getTextInputValue(
        "text-game-answer-riddle"
      );

      const correctAnswer = riddleData.answer.toLowerCase().trim();
      const userAnswerNormalized = userAnswer.toLowerCase().trim();

      if (
        correctAnswer.includes(userAnswerNormalized) ||
        userAnswerNormalized.includes(correctAnswer)
      ) {
        hasWon = true;
        await modalSubmit.reply({
          content: "🎉 That's correct! Well done!",
          flags: MessageFlags.Ephemeral,
        });
        collector.stop("Game Over!");
      } else {
        await modalSubmit.reply({
          content: "❌ Sorry, that's not correct. Keep trying!",
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on("end", async (_, endReason) => {
      // Send the final result message
      await interaction.followUp({
        content: `${
          endReason === "Game Over!" && hasWon
            ? "🎉 **You Won!**"
            : "⏰ **Time's Up!**"
        }\n\n**Riddle:** ${riddleData.riddle}\n**Category:** ${
          riddleData.category
        }\n**Answer:** \`${riddleData.answer}\``,
        flags: MessageFlags.Ephemeral,
      });
    });
  },
};

export default command;
