import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const command: CommandType = {
  name: "game-guess-the-number",
  description: "Guess the number game",

  async script(client, interaction, debugStream) {
    debugStream.write("Generating random number...");
    const randomNumber = Math.round(Math.random() * 1000);
    debugStream.write(`randomNumber: ${randomNumber}`);

    debugStream.write("Getting hints...");
    const hints = getHints(randomNumber);

    hints.forEach((hint, i) => debugStream.write(`Hint ${i + 1}: ${hint}`));

    debugStream.write("Creating game menu...");

    const gameEmbed = createEmbed({
      title: "Guess the Number",
      description:
        "I'm thinking of a number between 0 and 1000. Can you guess it?",
      color: Colors.Blue,
      fields: hints.map((hint, i) => ({ name: `Hint ${i + 1}`, value: hint })),
      thumbnail: {
        url: "https://i.postimg.cc/1tC0Vymb/Guess-The-Number.png",
      },
    });

    const answerBtn = new ButtonBuilder({
      customId: "game-guess-the-number-collector",
      emoji: "🎲",
      label: "Enter Guess",
      style: ButtonStyle.Success,
    });

    const answerBtnRow = new ActionRowBuilder<ButtonBuilder>({
      components: [answerBtn],
    });

    debugStream.write("Menu created! Sending menu...");

    const gameMessage = await interaction.followUp({
      content:
        "Can you guess the number correctly before the time runs out? Good luck!",
      embeds: [gameEmbed],
      components: [answerBtnRow],
    });

    debugStream.write("Menu sent! Creating collector...");

    const collector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 5 * 60 * 1000, //5min
    });

    const guesses: number[] = [];
    let hasWinner = false;

    const answerInput = new TextInputBuilder({
      customId: "game-guess-the-number-answer",
      label: "What's the number?",
      placeholder: "Enter your guess (0-1000)",
      style: TextInputStyle.Short,
      maxLength: 4,
      required: true,
    });

    const answerRow = new ActionRowBuilder<TextInputBuilder>({
      components: [answerInput],
    });

    const answerModal = new ModalBuilder({
      customId: "game-guess-the-number-answer-collector",
      title: "Guess The Number!",
      components: [answerRow],
    });

    collector.on("collect", async (i) => {
      await i.showModal(answerModal);

      const modalResponse = await i
        .awaitModalSubmit({
          time: 60_000, // 1 minute timeout for modal
          filter: (modalInteraction) =>
            modalInteraction.customId ===
            "game-guess-the-number-answer-collector",
        })
        .catch(() => null);

      if (!modalResponse) return;

      await modalResponse.deferUpdate();

      const guessInput = modalResponse.fields.getTextInputValue(
        "game-guess-the-number-answer"
      );
      const guess = Number(guessInput);

      if (isNaN(guess) || guess < 0 || guess > 1000) {
        await modalResponse.followUp({
          content: "Please enter a valid number between 0 and 1000.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (guesses.includes(guess)) {
        await modalResponse.followUp({
          content: "You have already guessed that number.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      guesses.push(guess);

      if (guess === randomNumber) {
        await modalResponse.followUp({
          content: "🎉 Congratulations! You guessed the number correctly!",
          flags: MessageFlags.Ephemeral,
        });

        await interaction.editReply({
          content: `🎉 **You Won!** You guessed the number correctly! The number was **${randomNumber}**.`,
          components: [],
        });

        hasWinner = true;
        collector.stop("Game Over!");
        return;
      } else {
        let hint = "";
        if (guess < randomNumber) {
          hint = " The number is higher!";
        } else {
          hint = " The number is lower!";
        }

        await modalResponse.followUp({
          content: `Sorry, that's not the number.${hint} Keep trying! (${
            10 - guesses.length
          } guesses remaining)`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (guesses.length >= 10) {
        await interaction.editReply({
          content: `😔 **Game Over!** You couldn't guess the number correctly. The number was **${randomNumber}**.`,
          components: [],
        });

        collector.stop("Game Over!");
        return;
      }
    });

    collector.on("end", async () => {
      if (!hasWinner) {
        await interaction.editReply({
          content: `⏰ **Time's Up!** You couldn't guess the number correctly. The number was **${randomNumber}**.`,
          components: [],
        });
      }
    });
  },
};

function getHints(randomNumber: number): string[] {
  const hints: string[] = [];

  if (randomNumber % 2 === 0) {
    hints.push("The number is even");
  } else {
    hints.push("The number is odd");
  }

  if (randomNumber > 500) {
    hints.push("The number is greater than 500");
  } else {
    hints.push("The number is less than or equal to 500");
  }

  if (randomNumber % 5 === 0) {
    hints.push("The number is divisible by 5");
  } else {
    hints.push("The number is not divisible by 5");
  }

  if (randomNumber > 250 && randomNumber < 750) {
    hints.push("The number is in the middle range (250-750)");
  } else {
    hints.push("The number is in the outer ranges (0-250 or 750-1000)");
  }

  if (randomNumber % 10 === 0) {
    hints.push("The number is divisible by 10");
  } else {
    hints.push("The number is not divisible by 10");
  }

  return hints;
}

export default command;
