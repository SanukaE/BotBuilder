import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  Colors,
  ComponentType,
  StringSelectMenuBuilder,
} from 'discord.js';

const command: CommandType = {
  name: 'game-rps',
  description: 'Play a game of rock, paper, scissors with someone.',
  options: [
    {
      name: 'player',
      description:
        'Select who you want to play against. If not selected, you will be playing against the computer.',
      type: ApplicationCommandOptionType.User,
    },
  ],

  async script(client, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const playerTwo = interaction.options.getUser('player');

    debugStream.write(`playerTwo: ${playerTwo?.displayName}`);

    if (playerTwo) {
      if (playerTwo.id === interaction.user.id) {
        debugStream.write('Player is trying to play against themselves!');
        await interaction.editReply('You cannot play against yourself!');
        return;
      }

      if (playerTwo.bot) {
        debugStream.write('Player is trying to play against a bot!');
        await interaction.editReply('You cannot play against a bot!');
        return;
      }
    }

    debugStream.write('Creating game menu...');

    const gameEmbed = createEmbed({
      title: `Rock, Paper, Scissors!`,
      description: `### How to Play:\n1. Rock beats Scissors\n2. Scissors beats Paper\n3. Paper beats Rock\n\n### Players:\nPlayer One: ${
        interaction.user.displayName
      }\nPlayer Two: ${playerTwo ? playerTwo.displayName : 'Computer'}`,
      color: Colors.DarkVividPink,
      thumbnail: {
        url: 'https://i.postimg.cc/59SnbMW5/Rock-Paper-Scissors.png',
      },
      fields: [
        {
          name: 'Player One',
          value: `❓ Waiting...`,
          inline: true,
        },
        {
          name: 'Player Two',
          value: `❓ Waiting...`,
          inline: true,
        },
      ],
    });

    const options = new StringSelectMenuBuilder({
      customId: `game-rps-options-collector`,
      options: [
        { label: 'Rock', value: '✊ Rock', emoji: '✊' },
        { label: 'Paper', value: '📄 Paper', emoji: '📄' },
        { label: 'Scissors', value: '✂ Scissors', emoji: '✂' },
      ],
      placeholder: 'Pick your choice...',
    });

    const optionsRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [options],
    });

    debugStream.write('Sending game menu...');

    if (!interaction.channel?.isSendable())
      throw new Error('Channel is not sendable!');

    await interaction.followUp({
      content: 'Read? Good Luck! 🍀',
      ephemeral: true,
    });

    await interaction.channel.sendTyping();

    const gameMessage = await interaction.channel.send({
      content: `<@${interaction.user.id}> vs ${
        playerTwo ? `<@${playerTwo.id}>` : 'Computer'
      }`,
      embeds: [gameEmbed],
      components: [optionsRow],
    });

    debugStream.write('Creating collector...');

    const optionCollector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) =>
        i.user.id === interaction.user.id || i.user.id === playerTwo?.id,
    });

    const choices = ['✊ Rock', '📄 Paper', '✂ Scissors'];

    const gameStats = {
      playerOne: '❓ Waiting...',
      playerTwo: playerTwo
        ? '❓ Waiting...'
        : choices[Math.floor(Math.random() * choices.length)],
    };

    optionCollector.on('collect', async (i) => {
      await i.deferUpdate();

      const player =
        interaction.user.id === i.user.id ? 'playerOne' : 'playerTwo';
      const choice = i.values[0];

      gameStats[player] = choice;

      await i.followUp({
        content: '✅ Your choice has been recorded!',
        ephemeral: true,
      });

      if (
        choices.includes(gameStats.playerOne) &&
        choices.includes(gameStats.playerTwo)
      ) {
        const winner = checkWin(gameStats.playerOne, gameStats.playerTwo);

        gameEmbed.setFields([
          {
            name: 'Player One',
            value: gameStats.playerOne,
            inline: true,
          },
          {
            name: 'Player Two',
            value: gameStats.playerTwo,
            inline: true,
          },
        ]);

        if (winner === 'tie')
          await gameMessage.edit({
            content: "🎉 It's a tie! 🎉",
            embeds: [gameEmbed],
            components: [],
          });
        else
          await gameMessage.edit({
            content:
              (winner === 'playerOne'
                ? `<@${interaction.user.id}>`
                : playerTwo
                ? `<@${playerTwo.id}>`
                : 'Computer') + ' wins! 🎉',
            embeds: [gameEmbed],
            components: [],
          });

        setTimeout(async () => {
          if (gameMessage.deletable) await gameMessage.delete();
        }, 10_000);

        optionCollector.stop('Game Over!');
      } else {
        gameEmbed.setFields([
          {
            name: 'Player One',
            value:
              player === 'playerOne'
                ? '🤐 Player has Picked an option!'
                : '⌛ Waiting for player...',
            inline: true,
          },
          {
            name: 'Player Two',
            value:
              player === 'playerTwo'
                ? '🤐 Player has Picked an option!'
                : '⌛ Waiting for player...',
            inline: true,
          },
        ]);

        await gameMessage.edit({
          content: `<@${interaction.user.id}> vs ${
            playerTwo ? `<@${playerTwo.id}>` : 'Computer'
          }`,
          embeds: [gameEmbed],
          components: [optionsRow],
        });
      }
    });

    debugStream.write('Collector created!');
  },
};

function checkWin(playerOneChoice: string, playerTwoChoice: string) {
  if (playerOneChoice === playerTwoChoice) return 'tie';
  if (
    (playerOneChoice === '✊ Rock' && playerTwoChoice === '✂ Scissors') ||
    (playerOneChoice === '✂ Scissors' && playerTwoChoice === '📄 Paper') ||
    (playerOneChoice === '📄 Paper' && playerTwoChoice === '✊ Rock')
  ) {
    return 'playerOne';
  } else {
    return 'playerTwo';
  }
}

export default command;
