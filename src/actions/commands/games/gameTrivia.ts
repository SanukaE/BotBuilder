import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  MessageFlags,
} from "discord.js";

const command: CommandType = {
  name: "game-trivia",
  description: "Start a trivia game",
  options: [
    {
      name: "questions",
      description: "The number of questions you want to answer",
      type: ApplicationCommandOptionType.Number,
      max_value: 50,
      min_value: 1,
    },
    {
      name: "category",
      description: "The category of the questions",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "General Knowledge", value: "9" },
        { name: "Books", value: "10" },
        { name: "Film", value: "11" },
        { name: "Music", value: "12" },
        { name: "Musicals & Theatres", value: "13" },
        { name: "Television", value: "14" },
        { name: "Video Games", value: "15" },
        { name: "Board Games", value: "16" },
        { name: "Science & Nature", value: "17" },
        { name: "Computers", value: "18" },
        { name: "Mathematics", value: "19" },
        { name: "Mythology", value: "20" },
        { name: "Sports", value: "21" },
        { name: "Geography", value: "22" },
        { name: "History", value: "23" },
        { name: "Politics", value: "24" },
        { name: "Art", value: "25" },
        { name: "Celebrities", value: "26" },
        { name: "Animals", value: "27" },
        { name: "Vehicles", value: "28" },
        { name: "Comics", value: "29" },
        { name: "Gadgets", value: "30" },
        { name: "Anime & Manga", value: "31" },
        { name: "Cartoon & Animations", value: "32" },
      ],
    },
    {
      name: "difficulty",
      description: "The difficulty of the questions",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "Easy", value: "easy" },
        { name: "Medium", value: "medium" },
        { name: "Hard", value: "hard" },
      ],
    },
    {
      name: "type",
      description: "The type of the questions",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "Multiple Choice", value: "multiple" },
        { name: "True / False", value: "boolean" },
      ],
    },
  ],

  async script(client, interaction, debugStream) {
    debugStream.write("Getting data from interaction...");

    const questions = interaction.options.getNumber("questions");
    const category = interaction.options.getString("category");
    const difficulty = interaction.options.getString("difficulty");
    const type = interaction.options.getString("type");

    debugStream.write(
      `questions: ${questions}, category: ${category}, difficulty: ${difficulty}, type: ${type}`
    );

    debugStream.write("Fetching data...");

    let apiUrl = `https://opentdb.com/api.php?amount=${questions || 10}`;

    if (category) apiUrl += `&category=${category}`;
    if (difficulty) apiUrl += `&difficulty=${difficulty}`;
    if (type) apiUrl += `&type=${type}`;

    const response = await fetch(apiUrl);

    debugStream.write(`Response Status: ${response.status}`);
    debugStream.write("Getting JSON data...");

    const responseData = await response.json();

    if (responseData.response_code !== 0)
      throw new Error(
        `Failed to fetch trivia questions. Response Code: ${responseData.response_code}`
      );

    const triviaQuestions = responseData.results;

    debugStream.write("Data fetched! Sending follow up...");

    let questionIndex = 0;

    const firstQuestion = triviaQuestions[questionIndex];

    const triviaEmbed = createEmbed({
      title: firstQuestion.question,
      description: "To answer, click on the button below",
      fields: [
        { name: "No", value: `1/${triviaQuestions.length}`, inline: true },
        { name: "Category", value: firstQuestion.category, inline: true },
        { name: "Difficulty", value: firstQuestion.difficulty, inline: true },
      ],
      color: Colors.Navy,
      thumbnail: { url: "https://i.postimg.cc/bNQKyfJq/Trivia.png" },
    });

    const buttons = createButtons(
      firstQuestion.correct_answer,
      firstQuestion.incorrect_answers
    );

    const triviaMessage = await interaction.followUp({
      embeds: [triviaEmbed],
      components: buttons,
      flags: MessageFlags.Ephemeral,
    });

    debugStream.write("Follow up sent! Creating collector...");

    const answerCollector = triviaMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith("game-trivia-answer"),
    });

    let correctAnswers = 0;
    let triviaStatTime = performance.now();

    answerCollector.on("collect", async (i) => {
      const userAnswer = i.customId.split("-")[3];
      const isCorrect =
        userAnswer === triviaQuestions[questionIndex].correct_answer;

      if (isCorrect) correctAnswers++;

      questionIndex++;

      if (questionIndex === triviaQuestions.length) {
        triviaEmbed.setTitle("Game Over!");
        triviaEmbed.setDescription(
          "The trivia is over! Let's see how big your brain is! You can check how you did bellow."
        );

        triviaEmbed.setFields([
          {
            name: "Overall Mark",
            value: `${((correctAnswers / triviaQuestions.length) * 100).toFixed(
              1
            )}%`,
            inline: true,
          },
          {
            name: "Total Questions",
            value: `${triviaQuestions.length}`,
            inline: true,
          },
          { name: "Correct Answers", value: `${correctAnswers}`, inline: true },
          {
            name: "Incorrect Answers",
            value: `${triviaQuestions.length - correctAnswers}`,
            inline: true,
          },
          {
            name: "Completed",
            value: `<t:${Math.floor(
              (performance.now() - triviaStatTime) / 1000 + Date.now() / 1000
            )}>`,
            inline: true,
          },
          {
            name: "Category",
            value: `${category || "Any"}`,
            inline: true,
          },
          {
            name: "Difficulty",
            value: `${difficulty || "Any"}`,
            inline: true,
          },
          {
            name: "Type",
            value: `${type || "Any"}`,
            inline: true,
          },
        ]);

        await i.update({
          embeds: [triviaEmbed],
          components: [],
        });

        answerCollector.stop("Game Over!");
        return;
      }

      const nextQuestion = triviaQuestions[questionIndex];

      triviaEmbed.setTitle(nextQuestion.question);

      triviaEmbed.setFields([
        {
          name: "No",
          value: `${questionIndex + 1}/${triviaQuestions.length}`,
          inline: true,
        },
        { name: "Category", value: nextQuestion.category, inline: true },
        { name: "Difficulty", value: nextQuestion.difficulty, inline: true },
      ]);

      const nextButtons = createButtons(
        nextQuestion.correct_answer,
        nextQuestion.incorrect_answers
      );

      await i.update({
        embeds: [triviaEmbed],
        components: nextButtons,
      });
    });
  },
};

function createButtons(correctAnswer: string, incorrectAnswers: string[]) {
  const choices = [correctAnswer, ...incorrectAnswers];
  const isMultipleChoice = choices.length > 2;

  if (!isMultipleChoice) {
    const trueBtn = new ButtonBuilder({
      customId: `game-trivia-answer-true-collector`,
      label: "True",
      style: ButtonStyle.Secondary,
    });

    const falseBtn = new ButtonBuilder({
      customId: `game-trivia-answer-false-collector`,
      label: "False",
      style: ButtonStyle.Secondary,
    });

    const buttonRow = new ActionRowBuilder<ButtonBuilder>({
      components: [trueBtn, falseBtn],
    });

    return [buttonRow];
  } else {
    const mixedChoices = choices.sort(() => Math.random() - 0.5);

    const optionA = new ButtonBuilder({
      customId: `game-trivia-answer-${mixedChoices[0]}-collector`,
      label: mixedChoices[0],
      style: ButtonStyle.Secondary,
    });

    const optionB = new ButtonBuilder({
      customId: `game-trivia-answer-${mixedChoices[1]}-collector`,
      label: mixedChoices[1],
      style: ButtonStyle.Secondary,
    });

    const optionC = new ButtonBuilder({
      customId: `game-trivia-answer-${mixedChoices[2]}-collector`,
      label: mixedChoices[2],
      style: ButtonStyle.Secondary,
    });

    const optionD = new ButtonBuilder({
      customId: `game-trivia-answer-${mixedChoices[3]}-collector`,
      label: mixedChoices[3],
      style: ButtonStyle.Secondary,
    });

    const firstRow = new ActionRowBuilder<ButtonBuilder>({
      components: [optionA, optionB],
    });
    const secondRow = new ActionRowBuilder<ButtonBuilder>({
      components: [optionC, optionD],
    });

    return [firstRow, secondRow];
  }
}

export default command;
