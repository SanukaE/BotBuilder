import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import {
  ActionRowBuilder,
  Colors,
  ComponentType,
  StringSelectMenuBuilder,
} from "discord.js";

const command: CommandType = {
  name: "game-rps",
  description: "Play a game of rock, paper, scissors with the computer.",

  async script(client, interaction, debugStream) {
    debugStream.write("Creating game menu...");

    const gameEmbed = createEmbed({
      title: `Rock, Paper, Scissors!`,
      description: `### How to Play:\n1. Rock beats Scissors\n2. Scissors beats Paper\n3. Paper beats Rock\n\n### Players:\n**You** vs **Computer**`,
      color: Colors.DarkVividPink,
      thumbnail: {
        url: "https://i.postimg.cc/59SnbMW5/Rock-Paper-Scissors.png",
      },
      fields: [
        {
          name: "Your Choice",
          value: `❓ Waiting...`,
          inline: true,
        },
        {
          name: "Computer's Choice",
          value: `❓ Hidden`,
          inline: true,
        },
      ],
    });

    const options = new StringSelectMenuBuilder({
      customId: `game-rps-options-collector`,
      options: [
        { label: "Rock", value: "✊ Rock", emoji: "✊" },
        { label: "Paper", value: "📄 Paper", emoji: "📄" },
        { label: "Scissors", value: "✂ Scissors", emoji: "✂" },
      ],
      placeholder: "Pick your choice...",
    });

    const optionsRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [options],
    });

    debugStream.write("Sending game menu...");

    const gameMessage = await interaction.followUp({
      content: `🎮 **${interaction.user.displayName}** vs **Computer**`,
      embeds: [gameEmbed],
      components: [optionsRow],
    });

    debugStream.write("Creating collector...");

    const optionCollector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === interaction.user.id,
      time: 60_000, // 1 minute timeout
    });

    const choices = ["✊ Rock", "📄 Paper", "✂ Scissors"];
    const computerChoice = choices[Math.floor(Math.random() * choices.length)];

    optionCollector.on("collect", async (i) => {
      await i.deferUpdate();

      const playerChoice = i.values[0];
      const winner = checkWin(playerChoice, computerChoice);

      gameEmbed.setFields([
        {
          name: "Your Choice",
          value: playerChoice,
          inline: true,
        },
        {
          name: "Computer's Choice",
          value: computerChoice,
          inline: true,
        },
      ]);

      let resultMessage = "";
      if (winner === "tie") {
        resultMessage = "🤝 **It's a tie!**";
      } else if (winner === "player") {
        resultMessage = `🎉 **${interaction.user.displayName} wins!**`;
      } else {
        resultMessage = "🤖 **Computer wins!**";
      }

      await interaction.editReply({
        content: resultMessage,
        embeds: [gameEmbed],
        components: [],
      });

      optionCollector.stop("Game Over!");
    });

    optionCollector.on("end", async (collected, reason) => {
      if (reason === "time" && collected.size === 0) {
        await interaction.editReply({
          content: "⏰ **Time's up!** The game has ended.",
          components: [],
        });
      }
    });

    debugStream.write("Collector created!");
  },
};

function checkWin(
  playerChoice: string,
  computerChoice: string
): "player" | "computer" | "tie" {
  if (playerChoice === computerChoice) return "tie";

  if (
    (playerChoice === "✊ Rock" && computerChoice === "✂ Scissors") ||
    (playerChoice === "✂ Scissors" && computerChoice === "📄 Paper") ||
    (playerChoice === "📄 Paper" && computerChoice === "✊ Rock")
  ) {
    return "player";
  } else {
    return "computer";
  }
}

export default command;
