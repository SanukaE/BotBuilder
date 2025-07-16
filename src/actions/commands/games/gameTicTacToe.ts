import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import { Schema, SchemaType } from "@google/generative-ai";
import {
  ActionRowBuilder,
  bold,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";

const gemini = Gemini();

const command: CommandType = {
  name: "game-tic-tac-toe",
  description: "Play a simple game of tic tac toe with me",
  isDisabled: !gemini.enabled,

  async script(client, interaction, debugStream) {
    //X: 1; O: 0
    let gameBoard: (undefined | number)[][] = [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ];
    let gameBoardLayout =
      "`--`**|**`--`**|**`--`\n**------------**\n`--`**|**`--`**|**`--`\n**------------**\n`--`**|**`--`**|**`--`";

    // Helper function to update the game board layout
    function updateGameBoardLayout(): string {
      let layout = "";
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const cell = gameBoard[row][col];
          if (cell === 1) {
            layout += "`❌`";
          } else if (cell === 0) {
            layout += "`⭕`";
          } else {
            layout += "`--`";
          }

          if (col < 2) {
            layout += "**|**";
          }
        }

        if (row < 2) {
          layout += "\n**------------**\n";
        }
      }
      return layout;
    }

    // Helper function to check for win condition
    function checkWin(
      board: (undefined | number)[][],
      player: number
    ): boolean {
      // Check rows
      for (let row = 0; row < 3; row++) {
        if (
          board[row][0] === player &&
          board[row][1] === player &&
          board[row][2] === player
        ) {
          return true;
        }
      }

      // Check columns
      for (let col = 0; col < 3; col++) {
        if (
          board[0][col] === player &&
          board[1][col] === player &&
          board[2][col] === player
        ) {
          return true;
        }
      }

      // Check diagonals
      if (
        board[0][0] === player &&
        board[1][1] === player &&
        board[2][2] === player
      ) {
        return true;
      }
      if (
        board[0][2] === player &&
        board[1][1] === player &&
        board[2][0] === player
      ) {
        return true;
      }

      return false;
    }

    // Helper function to check if board is full (tie)
    function isBoardFull(board: (undefined | number)[][]): boolean {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (board[row][col] === undefined) {
            return false;
          }
        }
      }
      return true;
    }

    // Helper function to get available moves
    function getAvailableMoves(
      board: (undefined | number)[][]
    ): { row: number; element: number }[] {
      const moves: { row: number; element: number }[] = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (board[row][col] === undefined) {
            moves.push({ row, element: col });
          }
        }
      }
      return moves;
    }

    //ID: row; element
    const firstActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [
        new ButtonBuilder({
          label: "1",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-0-0-collector",
        }),
        new ButtonBuilder({
          label: "2",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-0-1-collector",
        }),
        new ButtonBuilder({
          label: "3",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-0-2-collector",
        }),
      ],
    });
    const secondActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [
        new ButtonBuilder({
          label: "4",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-1-0-collector",
        }),
        new ButtonBuilder({
          label: "5",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-1-1-collector",
        }),
        new ButtonBuilder({
          label: "6",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-1-2-collector",
        }),
      ],
    });
    const thirdActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [
        new ButtonBuilder({
          label: "7",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-2-0-collector",
        }),
        new ButtonBuilder({
          label: "8",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-2-1-collector",
        }),
        new ButtonBuilder({
          label: "9",
          style: ButtonStyle.Primary,
          customId: "button-game-tictactoe-2-2-collector",
        }),
      ],
    });

    const followUpMsg = await interaction.followUp({
      content: `Good Luck! I'm pretty good 😏.\n\n` + gameBoardLayout,
      components: [firstActionRow, secondActionRow, thirdActionRow],
    });

    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith("button-game-tictactoe"),
    });

    let gameEnded = false;

    collector.on("collect", async (i) => {
      if (gameEnded) return;

      await i.deferUpdate();

      const inputData = {
        row: parseInt(i.customId.split("-")[3]),
        element: parseInt(i.customId.split("-")[4]),
      };
      const boardData = gameBoard[inputData.row][inputData.element];

      if (boardData !== undefined) {
        await i.followUp({
          content: "Slot is already taken. Pick again.",
          ephemeral: true,
        });
        return;
      }

      gameBoard[inputData.row][inputData.element] = 1; //X

      // Check if player won
      if (checkWin(gameBoard, 1)) {
        gameBoardLayout = updateGameBoardLayout();
        await i.editReply({
          content:
            `🎉 ${bold("You won!")} Congratulations!\n\n` + gameBoardLayout,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // Check if board is full (tie)
      if (isBoardFull(gameBoard)) {
        gameBoardLayout = updateGameBoardLayout();
        await i.editReply({
          content: `🤝 ${bold("It's a tie!")} Good game!\n\n` + gameBoardLayout,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      const responseSchema: Schema = {
        type: SchemaType.OBJECT,
        properties: {
          row: {
            type: SchemaType.NUMBER,
            description: "The row you want to place your O at (0-2)",
            example: 1,
          },
          element: {
            type: SchemaType.NUMBER,
            description: "The element you want to place your O at (0-2)",
            example: 2,
          },
        },
        required: ["row", "element"],
      };
      gemini.model!.generationConfig.responseMimeType = "application/JSON";
      gemini.model!.generationConfig.responseSchema = responseSchema;

      // Get available moves for AI
      const availableMoves = getAvailableMoves(gameBoard);

      const aiResult = gemini.model!.generateContent(
        `This is a game of tic tac toe and you're playing as O. X is represented as 1, O as 0 & undefined are the available slots you can pick from. 
        
        Current game board state:
        ${JSON.stringify(gameBoard)}
        
        Available moves: ${JSON.stringify(availableMoves)}
        
        From the game data above, where would you place O? Return only the row and element numbers (0-2 for each).`
      );

      try {
        const aiSpot: { row: number; element: number } = JSON.parse(
          (await aiResult).response.text()
        );

        // Validate AI move
        if (
          aiSpot.row < 0 ||
          aiSpot.row > 2 ||
          aiSpot.element < 0 ||
          aiSpot.element > 2 ||
          gameBoard[aiSpot.row][aiSpot.element] !== undefined
        ) {
          // Fallback to first available move if AI gives invalid response
          const fallbackMove = availableMoves[0];
          gameBoard[fallbackMove.row][fallbackMove.element] = 0;
        } else {
          gameBoard[aiSpot.row][aiSpot.element] = 0; //O
        }
      } catch (error) {
        // Fallback to first available move if parsing fails
        const fallbackMove = availableMoves[0];
        gameBoard[fallbackMove.row][fallbackMove.element] = 0;
      }

      // Update gameBoardLayout
      gameBoardLayout = updateGameBoardLayout();

      // Check if AI won
      if (checkWin(gameBoard, 0)) {
        await i.editReply({
          content:
            `😏 ${bold("I won!")} Better luck next time!\n\n` + gameBoardLayout,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // Check if board is full after AI move (tie)
      if (isBoardFull(gameBoard)) {
        await i.editReply({
          content: `🤝 ${bold("It's a tie!")} Good game!\n\n` + gameBoardLayout,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // Share updated stats with user
      await i.editReply({
        content: `Your turn! 🎮\n\n` + gameBoardLayout,
        components: [firstActionRow, secondActionRow, thirdActionRow],
      });
    });

    // Handle collector end
    collector.on("end", () => {
      if (!gameEnded) {
        followUpMsg.edit({
          content: "Game ended due to timeout or error.",
          components: [],
        });
      }
    });
  },
};

export default command;
