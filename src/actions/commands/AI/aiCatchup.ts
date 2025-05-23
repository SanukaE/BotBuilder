import Gemini from '#libs/Gemini.js';
import CommandType from '#types/CommandType.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import createTempDataFile from '#utils/createTempDataFile.js';
import getAllFiles from '#utils/getAllFiles.js';
import { ApplicationCommandOptionType, Colors } from 'discord.js';
import createEmbed from '#utils/createEmbed.js';
import { Schema, SchemaType } from '@google/generative-ai';

type Data = {
  username: string;
  createdTimestamp: number;
  messageContent?: string;
  attachments?: {
    contentType: string;
    fileName: string;
    fileURL: string;
  }[];
  embeds?: { title: string; description: string }[];
};

const command: CommandType = {
  name: 'ai-catchup',
  description: 'Catch up on what you missed in the past.',
  isGuildOnly: true,
  options: [
    {
      name: 'messages',
      description:
        'Specify the number of unread messages you want to catch up on.',
      type: ApplicationCommandOptionType.Integer,
      min_value: 10,
      max_value: 100,
      required: true,
    },
  ],

  async script(_, interaction, debugStream) {
    debugStream.write('Initializing AI...');
    const gemini = Gemini();

    if (!gemini.enabled) {
      debugStream.write('AI is not enabled! Sending reply...');
      await interaction.editReply('AI is not enabled');
      debugStream.write('Reply sent!');
      return;
    } else debugStream.write('Done! Getting data from interaction...');

    const messageNo = interaction.options.getInteger('messages', true);

    debugStream.write(`messageNo: ${messageNo}`);
    debugStream.write('Fetching messages...');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const tempFilePath = getAllFiles(
      path.join(__dirname, '../../../../temp')
    ).find((filePath) =>
      filePath
        .split('\\')
        .pop()
        ?.startsWith(`aiCatchup-${interaction.channelId}`)
    );

    let dataArray: Data[] = [];

    const getMessages = async (noOfMessage: number, before?: string) => {
      const channelMessage = await interaction.channel!.messages.fetch({
        limit: noOfMessage,
        before,
      });

      const messageArray = Array.from(channelMessage.values()).reverse(); //old --> new

      const allowedContentTypes = [
        'application/pdf',
        'text/javascript',
        'text/x-python',
        'text/plain',
        'text/html',
        'text/css',
        'text/md',
        'text/csv',
        'text/xml',
        'text/rtf',
      ];

      let tempDataArray: Data[] = [];

      for (const message of messageArray) {
        const messageData: Data = {
          username: message.author.displayName,
          createdTimestamp: message.createdTimestamp,
        };

        if (message.content) messageData.messageContent = message.content;

        const messageAttachments = message.attachments.filter(
          (attachment) =>
            attachment.contentType &&
            allowedContentTypes.includes(attachment.contentType)
        );

        if (messageAttachments.size > 0)
          messageData.attachments = Array.from(messageAttachments.values()).map(
            (a) => ({
              contentType: a.contentType!,
              fileName: a.name,
              fileURL: a.url,
            })
          );

        if (message.embeds.length > 0)
          messageData.embeds = message.embeds.map((embed) => ({
            title: embed.title ?? '',
            description: embed.description ?? '',
          }));

        tempDataArray.push(messageData);
      }

      return tempDataArray;
    };

    if (tempFilePath) {
      const oldMessageNo = tempFilePath.split('\\').pop()!.split('-')[2];
      const oldTimestamp = tempFilePath
        .split('\\')
        .pop()!
        .split('-')[3]
        .slice(0, -5);

      const remainingMsg = messageNo - Number(oldMessageNo);

      const fileContent = fs.readFileSync(tempFilePath, 'utf-8');
      dataArray = JSON.parse(fileContent);

      if (remainingMsg < 0) {
        const elementsToRemove = Math.abs(remainingMsg);
        dataArray = dataArray.splice(elementsToRemove - 1);
      }

      if (remainingMsg > 0) {
        dataArray = [
          ...(await getMessages(remainingMsg, oldTimestamp)),
          ...dataArray,
        ];

        const newFileName = `aiCatchup-${interaction.channelId}-${messageNo}-${dataArray[0].createdTimestamp}.json`;
        const newTempFilePath = path.join(
          path.dirname(tempFilePath),
          newFileName
        );

        fs.writeFileSync(tempFilePath, JSON.stringify(dataArray));
        fs.renameSync(tempFilePath, newTempFilePath);

        setTimeout(() => {
          if (fs.existsSync(newTempFilePath)) {
            fs.unlinkSync(newTempFilePath);
          }
        }, 60 * 60 * 1000); //1h
      }
    } else {
      dataArray = await getMessages(messageNo);

      createTempDataFile(
        `aiCatchup-${interaction.channelId}-${messageNo}-${dataArray[0].createdTimestamp}.json`,
        JSON.stringify(dataArray),
        60 * 60 * 1000 //1h
      );
    }

    debugStream.write('Messages collected! Generating summary...');

    const getFileData = async (file: {
      contentType: string;
      fileName: string;
      fileURL: string;
    }) => {
      const fileBuffer = await fetch(file.fileURL).then((response) =>
        response.arrayBuffer()
      );
      const fileData = Buffer.from(fileBuffer);
      createTempDataFile(file.fileName, fileData);

      const uploadResult = await gemini.fileManager!.uploadFile(
        `./public/${file.fileName}`,
        {
          mimeType: file.contentType,
          displayName: file.fileName,
        }
      );

      return {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      };
    };

    const filePromises = dataArray
      .filter((data) => data.attachments && data.attachments.length > 0)
      .flatMap((data) => data.attachments!)
      .map((attachment) => getFileData(attachment));

    const fileResults = await Promise.all(filePromises);

    const configFileResponse = await gemini.fileManager!.uploadFile(
      `./temp/aiCatchup-${interaction.channelId}-${messageNo}-${dataArray[0].createdTimestamp}.json`,
      {
        mimeType: 'text/json',
        displayName: 'Messages',
      }
    );

    const summarySchema: Schema = {
      type: SchemaType.ARRAY,
      description: 'A summary of the conversation',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          heading: {
            type: SchemaType.STRING,
            description:
              'A brief heading summarizing the main point or topic of the conversation segment.',
          },
          content: {
            type: SchemaType.STRING,
            description:
              'A detailed description of the conversation segment, providing more context and information.',
          },
        },
        required: ['heading', 'content'],
      },
    };

    gemini.model!.generationConfig.responseMimeType = 'application/json';
    gemini.model!.generationConfig.responseSchema = summarySchema;

    const result = await gemini.model!.generateContent([
      ...fileResults,
      {
        fileData: {
          fileUri: configFileResponse.file.uri,
          mimeType: configFileResponse.file.mimeType,
        },
      },
      'Generate a summary of the conversation from the provided "Messages" file. This file contains messages from a Discord channel, including potential threads and attachments. The summary should be clear, concise, and no longer than 2000 characters. Use markdown formatting where appropriate to enhance readability.',
    ]);

    debugStream.write('Summary generated! Sending follow up...');

    const embedMessage = createEmbed({
      color: Colors.Blue,
      title: 'Catchup',
      description: 'Please use caution as AI can make mistakes.',
      fields: JSON.parse(result.response.text()).map((summary: any) => ({
        name: summary.heading,
        value: summary.content,
      })),
    });

    await interaction.followUp({
      embeds: [embedMessage],
    });

    debugStream.write('Follow up sent!');
  },
};

export default command;
