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
  name: "game-hangman",
  description: "Play a classic word-guessing game of Hangman with me",
  isDisabled: !gemini.enabled,

  async script(client, interaction, debugStream) {
    const { geminiModel } = getConfig("ai") as { geminiModel: string };

    // Word bank for the game
    const wordBank = [
      "JAVASCRIPT",
      "TYPESCRIPT",
      "DISCORD",
      "COMPUTER",
      "PROGRAMMING",
      "ALGORITHM",
      "FUNCTION",
      "VARIABLE",
      "BOOLEAN",
      "STRING",
      "ARRAY",
      "OBJECT",
      "METHOD",
      "CALLBACK",
      "PROMISE",
      "FRAMEWORK",
      "LIBRARY",
      "DATABASE",
      "SERVER",
      "CLIENT",
      "CODING",
      "DEBUGGING",
      "TESTING",
      "DEPLOYMENT",
      "VERSION",
    ];

    // Select random word
    const targetWord = wordBank[Math.floor(Math.random() * wordBank.length)];
    let guessedWord = Array(targetWord.length).fill("_");
    let incorrectGuesses: string[] = [];
    let correctGuesses: string[] = [];
    const maxIncorrectGuesses = 6;

    // Hangman stages
    const hangmanStages = [
      "```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========\n```",
    ];

    // Helper function to update the game display
    function updateGameDisplay(): string {
      const wordDisplay = guessedWord.join(" ");
      const hangmanStage = hangmanStages[incorrectGuesses.length];
      const incorrectDisplay =
        incorrectGuesses.length > 0
          ? `**Incorrect guesses:** ${incorrectGuesses.join(", ")}`
          : "**Incorrect guesses:** None";
      const remainingGuesses = maxIncorrectGuesses - incorrectGuesses.length;

      return `${hangmanStage}\n**Word:** ${wordDisplay}\n${incorrectDisplay}\n**Remaining guesses:** ${remainingGuesses}`;
    }

    // Helper function to check if word is completely guessed
    function isWordComplete(): boolean {
      return !guessedWord.includes("_");
    }

    // Helper function to check if game is lost
    function isGameLost(): boolean {
      return incorrectGuesses.length >= maxIncorrectGuesses;
    }

    // Helper function to get available letters
    function getAvailableLetters(): string[] {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const usedLetters = [...correctGuesses, ...incorrectGuesses];
      return alphabet
        .split("")
        .filter((letter) => !usedLetters.includes(letter));
    }

    // Helper function to process guess
    function processGuess(letter: string): boolean {
      if (targetWord.includes(letter)) {
        correctGuesses.push(letter);
        for (let i = 0; i < targetWord.length; i++) {
          if (targetWord[i] === letter) {
            guessedWord[i] = letter;
          }
        }
        return true;
      } else {
        incorrectGuesses.push(letter);
        return false;
      }
    }

    // Create alphabet buttons (A-M)
    const firstRowButtons = [
      new ButtonBuilder({
        label: "A",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-A-collector",
      }),
      new ButtonBuilder({
        label: "B",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-B-collector",
      }),
      new ButtonBuilder({
        label: "C",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-C-collector",
      }),
      new ButtonBuilder({
        label: "D",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-D-collector",
      }),
      new ButtonBuilder({
        label: "E",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-E-collector",
      }),
    ];

    const secondRowButtons = [
      new ButtonBuilder({
        label: "F",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-F-collector",
      }),
      new ButtonBuilder({
        label: "G",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-G-collector",
      }),
      new ButtonBuilder({
        label: "H",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-H-collector",
      }),
      new ButtonBuilder({
        label: "I",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-I-collector",
      }),
      new ButtonBuilder({
        label: "J",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-J-collector",
      }),
    ];

    const thirdRowButtons = [
      new ButtonBuilder({
        label: "K",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-K-collector",
      }),
      new ButtonBuilder({
        label: "L",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-L-collector",
      }),
      new ButtonBuilder({
        label: "M",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-M-collector",
      }),
      new ButtonBuilder({
        label: "N",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-N-collector",
      }),
      new ButtonBuilder({
        label: "O",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-O-collector",
      }),
    ];

    const fourthRowButtons = [
      new ButtonBuilder({
        label: "P",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-P-collector",
      }),
      new ButtonBuilder({
        label: "Q",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-Q-collector",
      }),
      new ButtonBuilder({
        label: "R",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-R-collector",
      }),
      new ButtonBuilder({
        label: "S",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-S-collector",
      }),
      new ButtonBuilder({
        label: "T",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-T-collector",
      }),
    ];

    const fifthRowButtons = [
      new ButtonBuilder({
        label: "U",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-U-collector",
      }),
      new ButtonBuilder({
        label: "V",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-V-collector",
      }),
      new ButtonBuilder({
        label: "W",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-W-collector",
      }),
      new ButtonBuilder({
        label: "X",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-X-collector",
      }),
      new ButtonBuilder({
        label: "Y",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-Y-collector",
      }),
    ];

    const sixthRowButtons = [
      new ButtonBuilder({
        label: "Z",
        style: ButtonStyle.Secondary,
        customId: "button-game-hangman-Z-collector",
      }),
    ];

    const firstActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: firstRowButtons,
    });
    const secondActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: secondRowButtons,
    });
    const thirdActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: thirdRowButtons,
    });
    const fourthActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: fourthRowButtons,
    });
    const fifthActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: fifthRowButtons,
    });

    let gameDisplay = updateGameDisplay();

    const followUpMsg = await interaction.followUp({
      content: `Let's play Hangman! 🎯 Guess the word letter by letter!\n\n${gameDisplay}`,
      components: [
        firstActionRow,
        secondActionRow,
        thirdActionRow,
        fourthActionRow,
        fifthActionRow,
      ],
    });

    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith("button-game-hangman"),
      time: 300000, // 5 minutes
    });

    let gameEnded = false;

    collector.on("collect", async (i) => {
      if (gameEnded) return;

      await i.deferUpdate();

      const guessedLetter = i.customId.split("-")[3];

      // Check if letter was already guessed
      if (
        correctGuesses.includes(guessedLetter) ||
        incorrectGuesses.includes(guessedLetter)
      ) {
        await i.followUp({
          content: "You already guessed that letter! Pick a different one.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Process the guess
      const isCorrect = processGuess(guessedLetter);

      // Update display
      gameDisplay = updateGameDisplay();

      // Check if player won
      if (isWordComplete()) {
        await i.editReply({
          content: `🎉 ${bold(
            "You won!"
          )} Congratulations! You guessed the word!\n\n${gameDisplay}\n\n**The word was:** ${targetWord}`,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // Check if player lost
      if (isGameLost()) {
        await i.editReply({
          content: `💀 ${bold(
            "Game Over!"
          )} You ran out of guesses!\n\n${gameDisplay}\n\n**The word was:** ${targetWord}`,
          components: [],
        });
        gameEnded = true;
        collector.stop();
        return;
      }

      // Continue game - provide feedback and update display
      const feedback = isCorrect ? "✅ Correct guess!" : "❌ Incorrect guess!";
      await i.editReply({
        content: `${feedback}\n\n${gameDisplay}`,
        components: [
          firstActionRow,
          secondActionRow,
          thirdActionRow,
          fourthActionRow,
          fifthActionRow,
        ],
      });

      // Optional: AI hint system after multiple wrong guesses
      if (incorrectGuesses.length >= 3 && !gameEnded) {
        const responseSchema: Schema = {
          type: Type.OBJECT,
          properties: {
            hint: {
              type: Type.STRING,
              description:
                "A helpful hint about the word without giving it away",
              example: "This is related to computer programming",
            },
          },
          required: ["hint"],
        };

        try {
          const hintResult = await gemini.model!.generateContent({
            model: geminiModel || "gemini-2.5-flash",
            contents: `You are helping with a Hangman game. The word is "${targetWord}". 
            The player has guessed these letters correctly: ${
              correctGuesses.join(", ") || "none"
            }
            The player has guessed these letters incorrectly: ${incorrectGuesses.join(
              ", "
            )}
            Current word state: ${guessedWord.join(" ")}
            
            Provide a helpful hint about what this word might be, but don't give away the answer directly. 
            Keep it brief and encouraging.`,
            config: {
              responseJsonSchema: responseSchema,
              responseMimeType: "application/json",
            },
          });

          if (!hintResult.text) throw new Error("Failed to get hint.");

          const hintResponse: { hint: string } = JSON.parse(hintResult.text);

          await i.followUp({
            content: `💡 **Hint:** ${hintResponse.hint}`,
            flags: MessageFlags.Ephemeral,
          });
        } catch (error) {
          // Fallback hints based on word categories
          const fallbackHints = {
            JAVASCRIPT: "A popular programming language for web development",
            TYPESCRIPT: "A superset of JavaScript with static typing",
            DISCORD: "A communication platform for gamers and communities",
            COMPUTER: "An electronic device for processing data",
            PROGRAMMING: "The process of creating software",
            ALGORITHM: "A step-by-step procedure for solving problems",
            FUNCTION: "A reusable block of code",
            VARIABLE: "A container for storing data values",
            BOOLEAN: "A data type with true or false values",
            STRING: "A sequence of characters",
            ARRAY: "A collection of elements",
            OBJECT: "A collection of key-value pairs",
            METHOD: "A function that belongs to an object",
            CALLBACK: "A function passed as an argument to another function",
            PROMISE:
              "An object representing eventual completion of an operation",
            FRAMEWORK: "A platform for developing applications",
            LIBRARY: "A collection of pre-written code",
            DATABASE: "A system for storing and organizing data",
            SERVER: "A computer that provides services to other computers",
            CLIENT: "A computer that requests services from a server",
            CODING: "The process of writing instructions for computers",
            DEBUGGING: "The process of finding and fixing errors in code",
            TESTING: "The process of checking if software works correctly",
            DEPLOYMENT: "The process of making software available for use",
            VERSION: "A particular form or variant of something",
          };

          const hint =
            fallbackHints[targetWord as keyof typeof fallbackHints] ||
            "This word is related to technology!";
          await i.followUp({
            content: `💡 **Hint:** ${hint}`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });

    // Handle collector end
    collector.on("end", (collected, reason) => {
      if (!gameEnded) {
        followUpMsg
          .edit({
            content:
              reason === "time"
                ? `Game ended due to timeout ⏰\n\n**The word was:** ${targetWord}`
                : `Game ended due to error.\n\n**The word was:** ${targetWord}`,
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};

export default command;
