import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const command: CommandType = {
  name: 'game-guess-the-number',
  description: 'Guess the number game',

  async script(client, interaction, debugStream) {
    debugStream.write('Generating random number...');
    const randomNumber = Math.round(Math.random() * 1000);
    debugStream.write(`randomNumber: ${randomNumber}`);

    debugStream.write('Getting hints...');
    const hints = getHints(randomNumber);

    hints.forEach((hint, i) => debugStream.write(`Hint ${i + 1}: ${hint}`));

    debugStream.write('Creating game menu...');

    const gameEmbed = createEmbed({
      title: 'Guess the Number',
      description:
        "I'm thinking of a number between 0 and 1000. Can you guess it?",
      color: Colors.Blue,
      fields: hints.map((hint, i) => ({ name: `Hint ${i + 1}`, value: hint })),
      thumbnail: {
        url: 'https://i.postimg.cc/1tC0Vymb/Guess-The-Number.png',
      },
    });

    const answerBtn = new ButtonBuilder({
      customId: 'game-guess-the-number-collector',
      emoji: '🎲',
      label: 'Enter Guess',
      style: ButtonStyle.Success,
    });

    const answerBtnRow = new ActionRowBuilder<ButtonBuilder>({
      components: [answerBtn],
    });

    debugStream.write('Menu created! Sending menu...');

    if (!interaction.channel?.isSendable())
      throw new Error('Channel is not sendable!');

    await interaction.followUp({
      content: 'Ready? Good Luck! 🍀',
      ephemeral: true,
    });

    await interaction.channel.sendTyping();

    const gameMessage = await interaction.channel.send({
      content:
        'Lets see who is good with numbers here. First player to guess the number correct wins! Good Luck.',
      embeds: [gameEmbed],
      components: [answerBtnRow],
    });

    debugStream.write('Menu sent! Creating collector...');

    const collector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000, //5min
    });

    const guesses: number[] = [];
    let hasWinner = false;

    const answerInput = new TextInputBuilder({
      customId: 'game-guess-the-number-answer',
      label: "What's the number?",
      placeholder: 'Enter your guess',
      style: TextInputStyle.Short,
      maxLength: 1000,
      required: true,
    });

    const answerRow = new ActionRowBuilder<TextInputBuilder>({
      components: [answerInput],
    });

    const answerModel = new ModalBuilder({
      customId: 'game-guess-the-number-answer-collector',
      title: 'Guess The Number!',
      components: [answerRow],
    });

    collector.on('collect', async (i) => {
      await i.showModal(answerModel);

      const modalResponse = await i.awaitModalSubmit({
        time: 0,
        filter: (i) => i.customId === 'game-guess-the-number-answer-collector',
      });

      await modalResponse.deferUpdate();

      const guess = Number(
        modalResponse.fields.getTextInputValue('game-guess-the-number-answer')
      );

      if (isNaN(guess)) {
        await modalResponse.followUp({
          content: 'Please enter a valid number.',
          ephemeral: true,
        });
        return;
      }

      if (guesses.includes(guess)) {
        await modalResponse.followUp({
          content: 'Someone has already guessed that number.',
          ephemeral: true,
        });
        return;
      }

      guesses.push(guess);

      if (guess === randomNumber) {
        await modalResponse.followUp({
          content: 'Congratulations! You guessed the number correctly!',
          ephemeral: true,
        });

        await gameMessage.edit({
          content: `Congratulations <@${modalResponse.user.id}>! You guessed the number correctly! The number was ${randomNumber}.`,
          components: [],
        });

        hasWinner = true;
        collector.stop('Game Over!');
        return;
      } else
        await modalResponse.followUp({
          content: `Sorry, that's not the number. Keep trying!`,
          ephemeral: true,
        });

      if (guesses.length >= 10) {
        await gameMessage.edit({
          content: `Game Over! No one guessed the number correctly. The number was ${randomNumber}.`,
          components: [],
        });

        collector.stop('Game Over!');
        return;
      }
    });

    collector.on('end', async () => {
      if (!hasWinner)
        await gameMessage.edit({
          content: `Game Over! No one guessed the number correctly. The number was ${randomNumber}.`,
          components: [],
        });

      setTimeout(async () => {
        if (gameMessage.deletable) await gameMessage.delete();
      }, 10_000);
    });
  },
};

function getHints(randomNumber: number) {
  const hints: string[] = [];

  if (randomNumber % 2 === 0) {
    hints.push('The number is even');
  } else {
    hints.push('The number is odd');
  }

  if (randomNumber > 500) {
    hints.push('The number is greater than 500');
  } else {
    hints.push('The number is less than or equal to 500');
  }

  if (randomNumber % 5 === 0) {
    hints.push('The number is divisible by 5');
  } else {
    hints.push('The number is not divisible by 5');
  }

  if (randomNumber > 250 && randomNumber < 750) {
    hints.push('The number is in the middle range (250-750)');
  } else {
    hints.push('The number is in the outer ranges (0-250 or 750-1000)');
  }

  if (randomNumber % 10 === 0) {
    hints.push('The number is divisible by 10');
  } else {
    hints.push('The number is not divisible by 10');
  }

  return hints;
}

export default command;
