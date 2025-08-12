import MySQL from "#libs/MySQL.js";
import Gemini from "#libs/Gemini.js";
import getConfig from "#utils/getConfig.js";
import createEmbed from "#utils/createEmbed.js";
import sendLevelUpMessage from "#utils/sendLevelUpMessage.js";
import {
  Client,
  Message,
  OmitPartialGroupDMChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  ModalSubmitInteraction,
} from "discord.js";
import { RowDataPacket } from "mysql2";
import { Schema, Type } from "@google/genai";

type EventConfig = {
  enableChatEvents: boolean;
  eventChance: number;
  eventDuration: number;
  allowedEventsChannels: string[];
  rewardExperience: number;
};

const eventConfig = getConfig("events") as EventConfig;
const gemini = Gemini();

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.deletable) return;
  if (!message.inGuild()) return;
  if (message.author.bot) return;

  if (!eventConfig.enableChatEvents) return;
  if (message.channel.type !== ChannelType.GuildText) return;

  const { channelID: countChannelID, supportChannelID } = getConfig(
    "counting",
    "support"
  ) as {
    channelID: string;
    supportChannelID: string;
  };
  if (
    message.channelId === countChannelID ||
    message.channelId === supportChannelID
  )
    return;

  const [rows] = await MySQL.query<RowDataPacket[]>(
    "SELECT * FROM tickets WHERE channelID = ?",
    [message.channelId]
  );
  if (rows.length > 0) return;

  // Check if channel is allowed for events
  if (
    eventConfig.allowedEventsChannels.length > 0 &&
    !eventConfig.allowedEventsChannels.includes(message.channelId)
  )
    return;

  const chance = Math.max(0, Math.min(100, eventConfig.eventChance));
  const roll = Math.random() * 100;
  if (roll > chance) return;

  await message.channel.sendTyping();

  const games = [
    "20 Questions",
    "Guess The Number",
    "Hangman",
    "Riddle",
    "Scramble",
    "Trivia",
  ];
  const gameToPlay = games[Math.floor(Math.random() * games.length)];

  try {
    switch (gameToPlay) {
      case "20 Questions":
        await twentyQuestions(client, message);
        break;
      case "Guess The Number":
        await guessTheNumber(client, message);
        break;
      case "Hangman":
        await hangman(client, message);
        break;
      case "Riddle":
        await riddle(client, message);
        break;
      case "Scramble":
        await scramble(client, message);
        break;
      case "Trivia":
        await trivia(client, message);
        break;
    }
  } catch (error) {
    console.error(`Error in ${gameToPlay} event:`, error);
    await message.channel.send(
      "❌ Something went wrong with the event game. Please try again later."
    );
  }
}

let winners: string | string[] | undefined;
let gameCollector: any;

async function twentyQuestions(
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!gemini.enabled) return;

  try {
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

    if (!aiResult.text) throw new Error("Failed to think of an object");

    const object = JSON.parse(aiResult.text).object.toLowerCase().trim();

    const askQuestionBtn = new ButtonBuilder({
      customId: `event-20q-ask-collector`,
      emoji: "❓",
      label: "Ask Question",
      style: ButtonStyle.Primary,
    });

    const guessBtn = new ButtonBuilder({
      customId: `event-20q-guess-collector`,
      emoji: "🤔",
      label: "Make Guess",
      style: ButtonStyle.Success,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [askQuestionBtn, guessBtn],
    });

    const embed = createEmbed({
      color: Colors.Navy,
      title: "🎮 Event: 20 Questions!",
      description:
        "I'm thinking of something! Ask yes/no questions or make a guess. First to guess correctly wins!",
      fields: [
        { name: "Questions Asked", value: "0/20", inline: true },
        {
          name: "Time Limit",
          value: `${eventConfig.eventDuration} minutes`,
          inline: true,
        },
      ],
      thumbnail: { url: "https://i.postimg.cc/8z4RsdFL/20-Questions.jpg" },
    });

    const gameMessage = await message.channel.send({
      embeds: [embed],
      components: [actionRow],
    });

    gameCollector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: eventConfig.eventDuration * 60 * 1000,
    });

    let questionsAsked = 0;
    const maxQuestions = 20;
    const askedQuestions = new Set<string>();

    gameCollector.on("collect", async (i: any) => {
      try {
        if (i.customId === "event-20q-ask-collector") {
          if (questionsAsked >= maxQuestions) {
            await i.reply({
              content: "❌ Maximum questions reached!",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const modal = new ModalBuilder({
            customId: "event-20q-question-modal-collector",
            title: "Ask a Yes/No Question",
          });

          const questionInput = new TextInputBuilder({
            customId: "question-input",
            label: "Your Question",
            placeholder: "Ask a yes/no question...",
            style: TextInputStyle.Paragraph,
            required: true,
            maxLength: 200,
          });

          const actionRow = new ActionRowBuilder<TextInputBuilder>({
            components: [questionInput],
          });

          modal.addComponents(actionRow);
          await i.showModal(modal);

          const modalSubmit = await i
            .awaitModalSubmit({
              time: 60000,
              filter: (modalInteraction: ModalSubmitInteraction) =>
                modalInteraction.user.id === i.user.id,
            })
            .catch(() => null);

          if (!modalSubmit) return;

          const question = modalSubmit.fields
            .getTextInputValue("question-input")
            .trim();

          if (askedQuestions.has(question.toLowerCase())) {
            await modalSubmit.reply({
              content: "❌ This question has already been asked!",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          askedQuestions.add(question.toLowerCase());

          const answerSchema: Schema = {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.BOOLEAN,
                description: "Is the answer true or false",
              },
            },
            required: ["answer"],
          };

          const aiAnswer = await gemini.model!.generateContent({
            model: geminiModel || "gemini-2.5-flash",
            contents: `For a game of 20 questions, the object is a \`${object}\`. Is the answer to this question "${question}" true or false related to the object?`,
            config: {
              responseJsonSchema: answerSchema,
              responseMimeType: "application/json",
            },
          });

          if (!aiAnswer.text) throw new Error("Failed to answer question");

          const isTrue: boolean = JSON.parse(aiAnswer.text).answer;
          questionsAsked++;

          embed.addFields({
            name: `Q${questionsAsked}: ${question}`,
            value: isTrue ? "✅ Yes" : "❌ No",
            inline: false,
          });

          embed.data.fields![0].value = `${questionsAsked}/${maxQuestions}`;

          if (questionsAsked >= maxQuestions) {
            askQuestionBtn.setDisabled(true);
          }

          await modalSubmit.deferUpdate();
          await gameMessage.edit({
            embeds: [embed],
            components: [
              new ActionRowBuilder<ButtonBuilder>({
                components: [askQuestionBtn, guessBtn],
              }),
            ],
          });
        } else if (i.customId === "event-20q-guess-collector") {
          const modal = new ModalBuilder({
            customId: "event-20q-guess-modal-collector",
            title: "Make Your Guess",
          });

          const guessInput = new TextInputBuilder({
            customId: "guess-input",
            label: "What am I thinking of?",
            placeholder: "Enter your guess...",
            style: TextInputStyle.Short,
            required: true,
            maxLength: 100,
          });

          const actionRow = new ActionRowBuilder<TextInputBuilder>({
            components: [guessInput],
          });

          modal.addComponents(actionRow);
          await i.showModal(modal);

          const modalSubmit = await i
            .awaitModalSubmit({
              time: 60000,
              filter: (modalInteraction: ModalSubmitInteraction) =>
                modalInteraction.user.id === i.user.id,
            })
            .catch(() => null);

          if (!modalSubmit) return;

          const guess = modalSubmit.fields
            .getTextInputValue("guess-input")
            .toLowerCase()
            .trim();

          if (guess === object) {
            winners = i.user.id;
            await modalSubmit.deferUpdate();
            gameCollector.stop("won");
          } else {
            await modalSubmit.reply({
              content: "❌ That's not what I'm thinking of! Keep trying!",
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } catch (error) {
        console.error("Error in 20 questions event:", error);
        await i
          .reply({
            content: "❌ Something went wrong processing your action.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    });

    gameCollector.on("end", async (collected: any, reason: string) => {
      await gameFinished(client, gameMessage, object);
    });
  } catch (error) {
    console.error("Error in 20 questions setup:", error);
    await message.channel.send("❌ Failed to start 20 Questions game.");
  }
}

async function guessTheNumber(
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
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

    if (randomNumber >= 250 && randomNumber <= 750) {
      hints.push("The number is in the middle range (250-750)");
    } else {
      hints.push("The number is in the outer ranges (1-249 or 751-1000)");
    }

    if (randomNumber % 10 === 0) {
      hints.push("The number is divisible by 10");
    } else {
      hints.push("The number is not divisible by 10");
    }

    return hints;
  }
  try {
    const randomNumber = Math.round(Math.random() * 1000);
    const hints = getHints(randomNumber);

    const guessBtn = new ButtonBuilder({
      customId: "event-number-guess-collector",
      emoji: "🎲",
      label: "Make Guess",
      style: ButtonStyle.Success,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [guessBtn],
    });

    const embed = createEmbed({
      title: "🎮 Event: Guess the Number!",
      description:
        "I'm thinking of a number between 0 and 1000. First to guess correctly wins!",
      color: Colors.Blue,
      fields: [
        ...hints.map((hint, i) => ({
          name: `Hint ${i + 1}`,
          value: hint,
          inline: false,
        })),
        {
          name: "Time Limit",
          value: `${eventConfig.eventDuration} minutes`,
          inline: true,
        },
      ],
      thumbnail: { url: "https://i.postimg.cc/1tC0Vymb/Guess-The-Number.png" },
    });

    const gameMessage = await message.channel.send({
      embeds: [embed],
      components: [actionRow],
    });

    gameCollector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: eventConfig.eventDuration * 60 * 1000,
    });

    const userGuesses = new Map<string, number[]>();

    gameCollector.on("collect", async (i: any) => {
      try {
        const modal = new ModalBuilder({
          customId: "event-number-modal-collector",
          title: "Guess the Number",
        });

        const numberInput = new TextInputBuilder({
          customId: "number-input",
          label: "Your Guess (0-1000)",
          placeholder: "Enter a number between 0 and 1000",
          style: TextInputStyle.Short,
          required: true,
          maxLength: 4,
        });

        const actionRow = new ActionRowBuilder<TextInputBuilder>({
          components: [numberInput],
        });

        modal.addComponents(actionRow);
        await i.showModal(modal);

        const modalSubmit = await i
          .awaitModalSubmit({
            time: 60000,
            filter: (modalInteraction: ModalSubmitInteraction) =>
              modalInteraction.user.id === i.user.id,
          })
          .catch(() => null);

        if (!modalSubmit) return;

        const guessInput = modalSubmit.fields.getTextInputValue("number-input");
        const guess = Number(guessInput);

        if (isNaN(guess) || guess < 0 || guess > 1000) {
          await modalSubmit.reply({
            content: "❌ Please enter a valid number between 0 and 1000.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const userPreviousGuesses = userGuesses.get(i.user.id) || [];
        if (userPreviousGuesses.includes(guess)) {
          await modalSubmit.reply({
            content: "❌ You've already guessed that number!",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        userPreviousGuesses.push(guess);
        userGuesses.set(i.user.id, userPreviousGuesses);

        if (guess === randomNumber) {
          winners = i.user.id;
          await modalSubmit.deferUpdate();
          gameCollector.stop("won");
        } else {
          const hint =
            guess < randomNumber
              ? "The number is higher!"
              : "The number is lower!";
          await modalSubmit.reply({
            content: `❌ Not quite! ${hint}`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        console.error("Error in number guessing:", error);
        await i
          .reply({
            content: "❌ Something went wrong processing your guess.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    });

    gameCollector.on("end", async (collected: any, reason: string) => {
      await gameFinished(client, gameMessage, randomNumber.toString());
    });
  } catch (error) {
    console.error("Error in guess the number setup:", error);
    await message.channel.send("❌ Failed to start Guess the Number game.");
  }
}

async function hangman(
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  try {
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
    ];

    const targetWord = wordBank[Math.floor(Math.random() * wordBank.length)];
    let guessedWord = Array(targetWord.length).fill("_");
    let incorrectGuesses: string[] = [];
    let correctGuesses: string[] = [];
    const maxIncorrectGuesses = 6;

    const hangmanStages = [
      "```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========\n```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========\n```",
    ];

    const updateDisplay = () => {
      const wordDisplay = guessedWord.join(" ");
      const hangmanStage = hangmanStages[incorrectGuesses.length];
      const incorrectDisplay =
        incorrectGuesses.length > 0 ? incorrectGuesses.join(", ") : "None";
      const remainingGuesses = maxIncorrectGuesses - incorrectGuesses.length;

      return createEmbed({
        title: "🎮 Event: Hangman!",
        description: `${hangmanStage}\n**Word:** ${wordDisplay}\n**Incorrect:** ${incorrectDisplay}\n**Remaining:** ${remainingGuesses}`,
        color: Colors.Orange,
        fields: [
          {
            name: "Time Limit",
            value: `${eventConfig.eventDuration} minutes`,
            inline: true,
          },
        ],
      });
    };

    // Create button outside of the collector
    const createGuessButton = () => {
      return new ButtonBuilder({
        customId: "event-hangman-guess-collector",
        emoji: "🔤",
        label: "Guess Letter",
        style: ButtonStyle.Primary,
      });
    };

    const initialButton = createGuessButton();
    const initialActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [initialButton],
    });

    const gameMessage = await message.channel.send({
      content: "Guess the word letter by letter! First to complete it wins!",
      embeds: [updateDisplay()],
      components: [initialActionRow],
    });

    gameCollector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: eventConfig.eventDuration * 60 * 1000,
    });

    const userGuesses = new Map<string, string[]>();

    gameCollector.on("collect", async (i: any) => {
      try {
        const modal = new ModalBuilder({
          customId: "event-hangman-modal-collector",
          title: "Guess a Letter",
        });

        const letterInput = new TextInputBuilder({
          customId: "letter-input",
          label: "Letter (A-Z)",
          placeholder: "Enter a single letter",
          style: TextInputStyle.Short,
          required: true,
          maxLength: 1,
        });

        const actionRow = new ActionRowBuilder<TextInputBuilder>({
          components: [letterInput],
        });

        modal.addComponents(actionRow);
        await i.showModal(modal);

        const modalSubmit = await i
          .awaitModalSubmit({
            time: 60000,
            filter: (modalInteraction: ModalSubmitInteraction) =>
              modalInteraction.user.id === i.user.id,
          })
          .catch(() => null);

        if (!modalSubmit) return;

        const letterGuess = modalSubmit.fields
          .getTextInputValue("letter-input")
          .toUpperCase()
          .trim();

        if (!/^[A-Z]$/.test(letterGuess)) {
          await modalSubmit.reply({
            content: "❌ Please enter a single letter (A-Z).",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const userPreviousGuesses = userGuesses.get(i.user.id) || [];
        if (
          userPreviousGuesses.includes(letterGuess) ||
          correctGuesses.includes(letterGuess) ||
          incorrectGuesses.includes(letterGuess)
        ) {
          await modalSubmit.reply({
            content: "❌ This letter has already been guessed!",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        userPreviousGuesses.push(letterGuess);
        userGuesses.set(i.user.id, userPreviousGuesses);

        if (targetWord.includes(letterGuess)) {
          correctGuesses.push(letterGuess);
          for (let j = 0; j < targetWord.length; j++) {
            if (targetWord[j] === letterGuess) {
              guessedWord[j] = letterGuess;
            }
          }

          if (!guessedWord.includes("_")) {
            winners = i.user.id;
            await modalSubmit.deferUpdate();
            gameCollector.stop("won");
            return;
          }

          await modalSubmit.deferUpdate();

          // Create fresh components for the update
          const updatedButton = createGuessButton();
          const updatedActionRow = new ActionRowBuilder<ButtonBuilder>({
            components: [updatedButton],
          });

          await gameMessage.edit({
            embeds: [updateDisplay()],
            components: [updatedActionRow],
          });
        } else {
          incorrectGuesses.push(letterGuess);

          if (incorrectGuesses.length >= maxIncorrectGuesses) {
            await modalSubmit.deferUpdate();
            gameCollector.stop("lost");
            return;
          }

          await modalSubmit.deferUpdate();

          // Create fresh components for the update
          const updatedButton = createGuessButton();
          const updatedActionRow = new ActionRowBuilder<ButtonBuilder>({
            components: [updatedButton],
          });

          await gameMessage.edit({
            embeds: [updateDisplay()],
            components: [updatedActionRow],
          });
        }
      } catch (error) {
        console.error("Error in hangman:", error);
        await i
          .reply({
            content: "❌ Something went wrong processing your guess.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    });

    gameCollector.on("end", async (collected: any, reason: string) => {
      await gameFinished(client, gameMessage, targetWord);
    });
  } catch (error) {
    console.error("Error in hangman setup:", error);
    await message.channel.send("❌ Failed to start Hangman game.");
  }
}

async function riddle(
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  try {
    const categories = ["science", "math", "mystery", "funny", "logic"];
    const category = categories[Math.floor(Math.random() * categories.length)];

    const response = await fetch(
      `https://riddles-api-eight.vercel.app/${category}`
    );
    if (!response.ok) throw new Error("Failed to fetch riddle");

    const riddleData = (await response.json()) as {
      riddle: string;
      answer: string;
      category: string;
    };

    const answerBtn = new ButtonBuilder({
      customId: "event-riddle-answer-collector",
      emoji: "🧩",
      label: "Submit Answer",
      style: ButtonStyle.Success,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [answerBtn],
    });

    const embed = createEmbed({
      title: "🎮 Event: Riddle Time!",
      description: riddleData.riddle,
      color: Colors.Purple,
      fields: [
        { name: "Category", value: riddleData.category, inline: true },
        {
          name: "Time Limit",
          value: `${eventConfig.eventDuration} minutes`,
          inline: true,
        },
      ],
    });

    const gameMessage = await message.channel.send({
      content: "Solve this riddle! First correct answer wins!",
      embeds: [embed],
      components: [actionRow],
    });

    gameCollector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: eventConfig.eventDuration * 60 * 1000,
    });

    gameCollector.on("collect", async (i: any) => {
      try {
        const modal = new ModalBuilder({
          customId: "event-riddle-modal-collector",
          title: "Submit Your Answer",
        });

        const answerInput = new TextInputBuilder({
          customId: "answer-input",
          label: "Your Answer",
          placeholder: "What's your answer to the riddle?",
          style: TextInputStyle.Short,
          required: true,
          maxLength: 100,
        });

        const actionRow = new ActionRowBuilder<TextInputBuilder>({
          components: [answerInput],
        });

        modal.addComponents(actionRow);
        await i.showModal(modal);

        const modalSubmit = await i
          .awaitModalSubmit({
            time: 60000,
            filter: (modalInteraction: ModalSubmitInteraction) =>
              modalInteraction.user.id === i.user.id,
          })
          .catch(() => null);

        if (!modalSubmit) return;

        const userAnswer = modalSubmit.fields
          .getTextInputValue("answer-input")
          .toLowerCase()
          .trim();
        const correctAnswer = riddleData.answer.toLowerCase().trim();

        if (
          correctAnswer.includes(userAnswer) ||
          userAnswer.includes(correctAnswer)
        ) {
          winners = i.user.id;
          await modalSubmit.deferUpdate();
          gameCollector.stop("won");
        } else {
          await modalSubmit.reply({
            content: "❌ That's not correct! Keep thinking!",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        console.error("Error in riddle:", error);
        await i
          .reply({
            content: "❌ Something went wrong processing your answer.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    });

    gameCollector.on("end", async (collected: any, reason: string) => {
      await gameFinished(client, gameMessage, riddleData.answer);
    });
  } catch (error) {
    console.error("Error in riddle setup:", error);
    await message.channel.send("❌ Failed to start Riddle game.");
  }
}

async function scramble(
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  try {
    const response = await fetch("https://random-word-api.herokuapp.com/word");
    if (!response.ok) throw new Error("Failed to fetch word");

    function scrambleWord(word: string) {
      const chars = word.split("");
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]]; // Swap
      }
      return chars.join("");
    }

    const word = (await response.json())[0] as string;
    const scrambledWord = scrambleWord(word);

    const answerBtn = new ButtonBuilder({
      customId: "event-scramble-answer-collector",
      emoji: "🔀",
      label: "Submit Answer",
      style: ButtonStyle.Success,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [answerBtn],
    });

    const embed = createEmbed({
      title: "🎮 Event: Word Scramble!",
      description: `Unscramble this word: **${scrambledWord}**`,
      color: Colors.Green,
      fields: [
        { name: "Length", value: `${word.length} letters`, inline: true },
        {
          name: "Time Limit",
          value: `${eventConfig.eventDuration} minutes`,
          inline: true,
        },
      ],
    });

    const gameMessage = await message.channel.send({
      content: "Unscramble the word! First correct answer wins!",
      embeds: [embed],
      components: [actionRow],
    });

    gameCollector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: eventConfig.eventDuration * 60 * 1000,
    });

    gameCollector.on("collect", async (i: any) => {
      try {
        const modal = new ModalBuilder({
          customId: "event-scramble-modal-collector",
          title: "Unscramble the Word",
        });

        const wordInput = new TextInputBuilder({
          customId: "word-input",
          label: "Your Answer",
          placeholder: "Enter the unscrambled word",
          style: TextInputStyle.Short,
          required: true,
          maxLength: 50,
        });

        const actionRow = new ActionRowBuilder<TextInputBuilder>({
          components: [wordInput],
        });

        modal.addComponents(actionRow);
        await i.showModal(modal);

        const modalSubmit = await i
          .awaitModalSubmit({
            time: 60000,
            filter: (modalInteraction: ModalSubmitInteraction) =>
              modalInteraction.user.id === i.user.id,
          })
          .catch(() => null);

        if (!modalSubmit) return;

        const userAnswer = modalSubmit.fields
          .getTextInputValue("word-input")
          .toLowerCase()
          .trim();
        const correctAnswer = word.toLowerCase().trim();

        if (userAnswer === correctAnswer) {
          winners = i.user.id;
          await modalSubmit.deferUpdate();
          gameCollector.stop("won");
        } else {
          await modalSubmit.reply({
            content: "❌ That's not the word! Try again!",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        console.error("Error in scramble:", error);
        await i
          .reply({
            content: "❌ Something went wrong processing your answer.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    });

    gameCollector.on("end", async (collected: any, reason: string) => {
      await gameFinished(client, gameMessage, word);
    });
  } catch (error) {
    console.error("Error in scramble setup:", error);
    await message.channel.send("❌ Failed to start Word Scramble game.");
  }
}

async function trivia(
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  try {
    const response = await fetch(
      "https://opentdb.com/api.php?amount=1&type=multiple"
    );
    if (!response.ok) throw new Error("Failed to fetch trivia");

    const responseData = await response.json();
    if (responseData.response_code !== 0)
      throw new Error("Invalid trivia response");

    const question = responseData.results[0];
    const choices = [
      question.correct_answer,
      ...question.incorrect_answers,
    ].sort(() => Math.random() - 0.5);

    const buttons = choices.map(
      (choice: string, index: number) =>
        new ButtonBuilder({
          customId: `event-trivia-${index}-collector`,
          label: choice.substring(0, 80), // Discord button label limit
          style: ButtonStyle.Secondary,
        })
    );

    const actionRows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      actionRows.push(
        new ActionRowBuilder<ButtonBuilder>({
          components: buttons.slice(i, i + 2),
        })
      );
    }

    const embed = createEmbed({
      title: "🎮 Event: Trivia Time!",
      description: question.question,
      color: Colors.Gold,
      fields: [
        { name: "Category", value: question.category, inline: true },
        { name: "Difficulty", value: question.difficulty, inline: true },
        { name: "Time Limit", value: "30 seconds", inline: true },
      ],
      thumbnail: { url: "https://i.postimg.cc/bNQKyfJq/Trivia.png" },
    });

    const gameMessage = await message.channel.send({
      content: "Answer this trivia question! First correct answer wins!",
      embeds: [embed],
      components: actionRows,
    });

    gameCollector = gameMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30 * 1000, // 30 seconds for trivia
    });

    gameCollector.on("collect", async (i: any) => {
      try {
        const selectedIndex = parseInt(i.customId.split("-")[2]);
        const selectedAnswer = choices[selectedIndex];

        if (selectedAnswer === question.correct_answer) {
          winners = i.user.id;
          await i.deferUpdate();
          gameCollector.stop("won");
        } else {
          await i.reply({
            content: "❌ That's not correct! Better luck next time!",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        console.error("Error in trivia:", error);
        await i
          .reply({
            content: "❌ Something went wrong processing your answer.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    });

    gameCollector.on("end", async (collected: any, reason: string) => {
      await gameFinished(client, gameMessage, question.correct_answer);
    });
  } catch (error) {
    console.error("Error in trivia setup:", error);
    await message.channel.send("❌ Failed to start Trivia game.");
  }
}

async function gameFinished(
  client: Client,
  gameMessage: Message<false> | Message<true>,
  gameAnswer: string
) {
  if (gameMessage.channel.type !== ChannelType.GuildText) return;

  await gameMessage.channel.sendTyping();

  let winnerNames: string[] = [];
  if (winners) {
    if (typeof winners === "string") {
      const user = await client.users.fetch(winners);
      winnerNames.push(user.displayName);
    } else {
      for (const winner of winners) {
        const user = await client.users.fetch(winner);
        winnerNames.push(user.displayName);
      }
    }
  }

  await gameMessage.reply(
    `This even is now over with ${
      winners
        ? winnerNames.join(", ") + " taking the win"
        : "no winners sadly : ("
    }. The answer for the event was: ${gameAnswer}`
  );

  await gameMessage.edit({
    content: `This even is now over with ${
      winners
        ? winnerNames.join(", ") + " taking the win"
        : "no winners sadly : ("
    }. The answer for the event was: ${gameAnswer}`,
    components: [],
  });

  if (!eventConfig.rewardExperience) return;
  if (!winners) return;

  const experienceConfig = getConfig("experience") as any;
  if (!experienceConfig.enableExperience) return;

  const checkLevelUp = (currentXP: number, level: number) => {
    const startingXPRequirement =
      experienceConfig.startingXPRequirement as number;
    const nextLevelXPRequirement =
      experienceConfig.nextLevelXPRequirement as number;

    const requiredXP =
      startingXPRequirement * Math.pow(nextLevelXPRequirement, level - 1);
    return { leveled: currentXP >= requiredXP, requiredXP };
  };

  if (typeof winners === "string") {
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels WHERE userID = ?",
      [winners]
    );

    let multiplier = 1;

    const member = await gameMessage.guild!.members.fetch(winners)!;
    const boosterCategories: string[] = [
      ...experienceConfig.boosterRoles,
      ...experienceConfig.boosterChannels,
      ...experienceConfig.boosterUsers,
    ];

    for (const booster of boosterCategories) {
      const [boosterID, boosterMultiplier] = booster.split(":");

      if (
        member.roles.cache.has(boosterID) ||
        member.user.id === boosterID ||
        gameMessage.channelId === boosterID
      )
        multiplier += experienceConfig.addExperienceMultiplier
          ? parseFloat(boosterMultiplier)
          : Math.max(multiplier, parseFloat(boosterMultiplier));
    }

    const xpGained = eventConfig.rewardExperience * multiplier;

    let levelUp: { leveled: boolean; requiredXP: number } = {
      leveled: false,
      requiredXP: 0,
    };

    if (rows.length === 0) {
      levelUp = checkLevelUp(xpGained, 1);

      await MySQL.query(
        "INSERT INTO user_levels (userID, level, experience) VALUES (?, ?, ?)",
        [
          winners,
          levelUp.leveled ? 2 : 1,
          levelUp.leveled ? xpGained - levelUp.requiredXP : xpGained,
        ]
      );

      if (levelUp.leveled)
        await sendLevelUpMessage(
          client,
          gameMessage.channelId,
          winnerNames[0],
          levelUp.leveled ? 2 : 1
        );
    } else {
      const userData = rows[0];
      const currentXP = userData.experience + xpGained;
      levelUp = checkLevelUp(currentXP, userData.level);

      await MySQL.query(
        "UPDATE user_levels SET level = ?, experience = ? WHERE userID = ?",
        [
          levelUp.leveled ? userData.level + 1 : userData.level,
          levelUp.leveled ? currentXP - levelUp.requiredXP : currentXP,
          winners,
        ]
      );

      if (levelUp.leveled)
        await sendLevelUpMessage(
          client,
          gameMessage.channelId,
          winnerNames[0],
          levelUp.leveled ? userData.level + 1 : userData.level
        );
    }
  } else {
    for (const winner of winners) {
      const [rows] = await MySQL.query<RowDataPacket[]>(
        "SELECT * FROM user_levels WHERE userID = ?",
        [winner]
      );

      let multiplier = 1;

      const member = await gameMessage.guild!.members.fetch(winner)!;
      const boosterCategories: string[] = [
        ...experienceConfig.boosterRoles,
        ...experienceConfig.boosterChannels,
        ...experienceConfig.boosterUsers,
      ];

      for (const booster of boosterCategories) {
        const [boosterID, boosterMultiplier] = booster.split(":");

        if (
          member.roles.cache.has(boosterID) ||
          member.user.id === boosterID ||
          gameMessage.channelId === boosterID
        )
          multiplier += experienceConfig.addExperienceMultiplier
            ? parseFloat(boosterMultiplier)
            : Math.max(multiplier, parseFloat(boosterMultiplier));
      }

      const xpGained = eventConfig.rewardExperience * multiplier;

      let levelUp: { leveled: boolean; requiredXP: number } = {
        leveled: false,
        requiredXP: 0,
      };

      if (rows.length === 0) {
        levelUp = checkLevelUp(xpGained, 1);

        await MySQL.query(
          "INSERT INTO user_levels (userID, level, experience) VALUES (?, ?, ?)",
          [
            winner,
            levelUp.leveled ? 2 : 1,
            levelUp.leveled ? xpGained - levelUp.requiredXP : xpGained,
          ]
        );

        if (levelUp.leveled)
          await sendLevelUpMessage(
            client,
            gameMessage.channelId,
            member.displayName,
            levelUp.leveled ? 2 : 1
          );
      } else {
        const userData = rows[0];
        const currentXP = userData.experience + xpGained;
        levelUp = checkLevelUp(currentXP, userData.level);

        await MySQL.query(
          "UPDATE user_levels SET level = ?, experience = ? WHERE userID = ?",
          [
            levelUp.leveled ? userData.level + 1 : userData.level,
            levelUp.leveled ? currentXP - levelUp.requiredXP : currentXP,
            member.user.id,
          ]
        );

        if (levelUp.leveled)
          await sendLevelUpMessage(
            client,
            gameMessage.channelId,
            member.displayName,
            levelUp.leveled ? userData.level + 1 : userData.level
          );
      }
    }
  }

  await gameMessage.channel.sendTyping();
  await gameMessage.reply(
    `Winners of this event have been award with \`${eventConfig.rewardExperience}xp\` each.`
  );
}
