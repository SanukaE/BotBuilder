import CommandType from "#types/CommandType.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

function scrambleWord(word: string) {
  const chars = word.split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]]; // Swap
  }
  return chars.join("");
}

const command: CommandType = {
  name: "game-scramble",
  description: "Unscramble the given word",
  options: [
    {
      name: "length",
      description: "Sets the length of the requested word (default: random)",
      type: ApplicationCommandOptionType.Integer,
      min_value: 3,
    },
    {
      name: "language",
      description: "The language of the word (default: en)",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "Spanish", value: "es" },
        { name: "Italian", value: "it" },
        { name: "German", value: "de" },
        { name: "French", value: "fr" },
        { name: "Chinese", value: "zh" },
        { name: "Brazilian Portuguese", value: "pt-br" },
      ],
    },
  ],

  async script(client, interaction, debugStream) {
    const language = interaction.options.getString("language");
    const length = interaction.options.getInteger("length");

    const apiURL =
      "https://random-word-api.herokuapp.com/word" +
      (length ? `?lang=${length}` : "") +
      (language ? `?lang=${language}` : "");
    const response = await fetch(apiURL);
    if (!response.ok) throw new Error("The response was not ok");

    const word = (await response.json())[0] as string;
    const wordData = {
      word,
      scrambled: scrambleWord(word),
    };

    const answerBtn = new ButtonBuilder({
      customId: "button-game-scramble-collector",
      label: "Answer",
      style: ButtonStyle.Success,
    });
    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [answerBtn],
    });

    const followUpMsg = await interaction.followUp({
      content: `Unscramble this word: \`${wordData.scrambled}\`\n> ⏳ You have 5 min to answer!`,
      components: [actionRow],
    });

    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === "button-game-scramble-collector",
      time: 5 * 60 * 1000, //5 min
    });

    let hasWon = false;

    collector.on("collect", async (i) => {
      const modal = new ModalBuilder({
        customId: "modal-game-scramble-collector",
        title: "Enter your answer",
      });

      const textInput = new TextInputBuilder({
        customId: "text-game-answer-scramble",
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
          modalInteraction.customId === "modal-game-scramble-collector",
      });

      const userAnswer = modalSubmit.fields.getTextInputValue(
        "text-game-answer-scramble"
      );

      const correctAnswer = wordData.word.toLowerCase().trim();
      const userAnswerNormalized = userAnswer.toLowerCase().trim();

      if (
        correctAnswer.includes(userAnswerNormalized) ||
        userAnswerNormalized.includes(correctAnswer)
      ) {
        hasWon = true;
        await modalSubmit.reply({
          content: "🎉 That's correct! Well done!",
          ephemeral: true,
        });
        collector.stop("Game Over!");
      } else {
        await modalSubmit.reply({
          content: "❌ Sorry, that's not correct. Keep trying!",
          ephemeral: true,
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
        }\n\n**Scrambled Word:** ${wordData.scrambled}\n**Answer:** \`${
          wordData.word
        }\``,
        ephemeral: true,
      });
    });
  },
};

export default command;
