import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import getConfig from "#utils/getConfig.js";
import { Schema, Type } from "@google/genai";
import {
  ActionRowBuilder,
  bold,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

const gemini = Gemini();

const command: CommandType = {
  name: "game-connect-4",
  description: "Play a game of Connect 4 with me",
  isDisabled: !gemini.enabled,

  async script(client, interaction, debugStream) {
    const { geminiModel } = getConfig("ai") as { geminiModel: string };

    // Red: 1; Yellow: 0
    let gameBoard: (undefined | number)[][] = Array(6)
      .fill(null)
      .map(() => Array(7).fill(undefined));

    // Helper function to update the game board layout
    function updateGameBoardLayout(): string {
      let layout = "`1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣`\n";

      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
          const cell = gameBoard[row][col];
          if (cell === 1) {
            layout += "🔴";
          } else if (cell === 0) {
            layout += "🟡";
          } else {
            layout += "⚫";
          }
        }
        layout += "\n";
      }
      return layout;
    }

    // Helper function to check for win condition
    function checkWin(
      board: (undefined | number)[][],
      player: number
    ): boolean {
      // Check horizontal
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
          if (
            board[row][col] === player &&
            board[row][col + 1] === player &&
            board[row][col + 2] === player &&
            board[row][col + 3] === player
          ) {
            return true;
          }
        }
      }

      // Check vertical
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 7; col++) {
          if (
            board[row][col] === player &&
            board[row + 1][col] === player &&
            board[row + 2][col] === player &&
            board[row + 3][col] === player
          ) {
            return true;
          }
        }
      }

      // Check diagonal (top-left to bottom-right)
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          if (
            board[row][col] === player &&
            board[row + 1][col + 1] === player &&
            board[row + 2][col + 2] === player &&
            board[row + 3][col + 3] === player
          ) {
            return true;
          }
        }
      }

      // Check diagonal (top-right to bottom-left)
      for (let row = 0; row < 3; row++) {
        for (let col = 3; col < 7; col++) {
          if (
            board[row][col] === player &&
            board[row + 1][col - 1] === player &&
            board[row + 2][col - 2] === player &&
            board[row + 3][col - 3] === player
          ) {
            return true;
          }
        }
      }

      return false;
    }

    // Helper function to check if board is full (tie)
    function isBoardFull(board: (undefined | number)[][]): boolean {
      for (let col = 0; col < 7; col++) {
        if (board[0][col] === undefined) {
          return false;
        }
      }
      return true;
    }

    // Helper function to get available columns
    function getAvailableColumns(board: (undefined | number)[][]): number[] {
      const columns: number[] = [];
      for (let col = 0; col < 7; col++) {
        if (board[0][col] === undefined) {
          columns.push(col);
        }
      }
      return columns;
    }

    // Helper function to drop piece in column
    function dropPiece(
      board: (undefined | number)[][],
      col: number,
      player: number
    ): boolean {
      for (let row = 5; row >= 0; row--) {
        if (board[row][col] === undefined) {
          board[row][col] = player;
          return true;
        }
      }
      return false; // Column is full
    }

    // Helper function to simulate drop for AI (without modifying board)
    function getDropRow(board: (undefined | number)[][], col: number): number {
      for (let row = 5; row >= 0; row--) {
        if (board[row][col] === undefined) {
          return row;
        }
      }
      return -1; // Column is full
    }

    let gameBoardLayout = updateGameBoardLayout();

    const firstRowButtons = [
      new ButtonBuilder({
        label: "1",
        style: ButtonStyle.Primary,
        customId: "button-game-connect4-0-collector",
      }),
      new ButtonBuilder({
        label: "2",
        style: ButtonStyle.Primary,
        customId: "button-game-connect4-1-collector",
      }),
      new ButtonBuilder({
        label: "3",
        style: ButtonStyle.Primary,
        customId: "button-game-connect4-2-collector",
      }),
      new ButtonBuilder({
        label: "4",
        style: ButtonStyle.Primary,
        customId: "button-game-connect4-3-collector",
      }),
    ];

    const secondRowButtons = [
      new ButtonBuilder({
        label: "5",
        style: ButtonStyle.Primary,
        customId: "button-game-connect4-4-collector",
      }),
      new ButtonBuilder({
        label: "6",
        style: ButtonStyle.Primary,
        customId: "button-game-connect4-5-collector",
      }),
      new ButtonBuilder({
        label: "7",
        style: ButtonStyle.Primary,
        customId: "button-game-connect4-6-collector",
      }),
    ];

    const firstActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: firstRowButtons,
    });

    const secondActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: secondRowButtons,
    });

    const followUpMsg = await interaction.followUp({
      content:
        `Let's play Connect 4! You are 🔴 and I'm 🟡. Get 4 in a row to win! 🎯\n\n` +
        gameBoardLayout,
      components: [firstActionRow, secondActionRow],
    });

    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith("button-game-connect4"),
    });

    let gameEnded = false;

    collector.on("collect", async (i) => {
      if (gameEnded) return;

      await i.deferUpdate();

      const column = parseInt(i.customId.split("-")[3]);

      // Check if column is valid and not full
      if (getDropRow(gameBoard, column) === -1) {
        await i.followUp({
          content: "Column is full! Pick another column.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Player move
      dropPiece(gameBoard, column, 1); // Red

      // Immediately update the board to show player's move
      gameBoardLayout = updateGameBoardLayout();
      await i.editReply({
        content:
          `You played column ${column + 1}! 🔴 My turn now... 🤔\n\n` +
          gameBoardLayout,
        components: [], // Disable buttons while AI is thinking
      });

      // Check if player won
      if (checkWin(gameBoard, 1)) {
        await i.editReply({
          content:
            `🎉 ${bold("You won!")} Congratulations! You got 4 in a row!\n\n` +
            gameBoardLayout,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // Check if board is full (tie)
      if (isBoardFull(gameBoard)) {
        await i.editReply({
          content:
            `🤝 ${bold("It's a tie!")} The board is full! Good game!\n\n` +
            gameBoardLayout,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // AI Turn
      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          column: {
            type: Type.NUMBER,
            description: "The column you want to drop your piece into (0-6)",
            example: 3,
          },
        },
        required: ["column"],
      };

      // Get available columns for AI
      const availableColumns = getAvailableColumns(gameBoard);

      let aiColumn: number;

      try {
        const aiResult = await gemini.model!.generateContent({
          model: geminiModel || "",
          contents: `This is a game of Connect 4 and you're playing as Yellow (🟡). Red is represented as 1, Yellow as 0 & undefined are the empty slots. 
          The goal is to get 4 pieces in a row (horizontally, vertically, or diagonally).
          
          Current game board state (6 rows x 7 columns):
          ${JSON.stringify(gameBoard)}
          
          Available columns to drop piece into: ${JSON.stringify(
            availableColumns
          )}
          
          From the game data above, which column (0-6) would you drop your Yellow piece into? 
          Consider both offensive moves (trying to get 4 in a row) and defensive moves (blocking the opponent).
          Return only the column number.`,
          config: {
            responseJsonSchema: responseSchema,
            responseMimeType: "application/json",
          },
        });

        if (!aiResult.text)
          throw new Error("Failed to get response from Gemini.");

        const aiMove: { column: number } = JSON.parse(aiResult.text);

        // Validate AI move
        if (
          aiMove.column < 0 ||
          aiMove.column > 6 ||
          !availableColumns.includes(aiMove.column)
        ) {
          // Fallback to random available column if AI gives invalid response
          aiColumn =
            availableColumns[
              Math.floor(Math.random() * availableColumns.length)
            ];
        } else {
          aiColumn = aiMove.column;
        }
      } catch (error) {
        // Fallback to random available column if parsing fails
        aiColumn =
          availableColumns[Math.floor(Math.random() * availableColumns.length)];
      }

      // Make AI move
      dropPiece(gameBoard, aiColumn, 0); // Yellow

      // Update gameBoardLayout after AI move
      gameBoardLayout = updateGameBoardLayout();

      // Check if AI won
      if (checkWin(gameBoard, 0)) {
        await i.editReply({
          content:
            `😎 ${bold("I won!")} I played column ${
              aiColumn + 1
            } and got 4 in a row! Better luck next time!\n\n` + gameBoardLayout,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // Check if board is full after AI move (tie)
      if (isBoardFull(gameBoard)) {
        await i.editReply({
          content:
            `🤝 ${bold("It's a tie!")} The board is full! Good game!\n\n` +
            gameBoardLayout,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // Continue game - update display with AI's move
      await i.editReply({
        content:
          `I played column ${
            aiColumn + 1
          }! 🟡 Your turn! Choose a column to drop your 🔴 piece!\n\n` +
          gameBoardLayout,
        components: [firstActionRow, secondActionRow],
      });
    });

    // Handle collector end
    collector.on("end", (collected, reason) => {
      if (!gameEnded) {
        followUpMsg
          .edit({
            content:
              reason === "time"
                ? "Game ended due to timeout ⏰"
                : "Game ended due to error.",
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};

export default command;
