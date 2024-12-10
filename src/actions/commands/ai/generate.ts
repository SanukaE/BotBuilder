import {
  ApplicationCommandOptionType,
  CommandInteractionOption,
  CacheType,
  AttachmentBuilder,
} from 'discord.js';
import CommandType from '../../../utils/CommandType.js';
import Replicate from 'replicate';
import 'dotenv/config';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const command: CommandType = {
  name: 'generate',
  description:
    'Use the power of AI to generate images, music, videos, or speech.',
  isDevOnly: true,
  options: [
    {
      name: 'type',
      description: 'What are you looking to generate from the prompt?',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: 'Image',
          value: 'image',
        },
        {
          name: 'Music',
          value: 'music',
        },
        {
          name: 'Video',
          value: 'video',
        },
        {
          name: 'Speech',
          value: 'speech',
        },
      ],
    },
    {
      name: 'prompt',
      description: 'Describe to the AI what you are hoping to create.',
      type: ApplicationCommandOptionType.String,
    },
    {
      name: 'file',
      description: 'The file you want to use.',
      type: ApplicationCommandOptionType.Attachment,
    },
  ],

  async script(client, interaction) {
    const usersChoice = interaction.options.getString('type');
    const usersPrompt = interaction.options.getString('prompt');
    const usersFile = interaction.options.getAttachment('file');

    if (!usersPrompt) {
      await interaction.editReply('Please provide a prompt.');
      return;
    }

    let input: any;
    let model: any;
    let outputFileType = '';

    switch (usersChoice) {
      case 'image':
        if (
          usersFile &&
          !checkFileType(usersFile, ['jpeg', 'png', 'gif', 'webp'])
        ) {
          await interaction.editReply(
            'Attached file is not valid. (Supported types: jpeg, png, gif, or webp)'
          );
          return;
        }

        input = {
          prompt: usersPrompt,
          prompt_upsampling: true,
          image_prompt: usersFile?.url,
        };

        model = 'black-forest-labs/flux-1.1-pro';
        outputFileType = 'jpeg';
        break;

      case 'music':
        input = {
          prompt_a: usersPrompt,
        };

        model =
          'riffusion/riffusion:8cf61ea6c56afd61d8f5b9ffd14d7c216c0a93844ce2d82ac1c9ecc9c7f24e05';
        outputFileType = 'wav';
        break;

      case 'video':
        input = {
          prompt: usersPrompt,
        };

        model =
          'lucataco/animate-diff:beecf59c4aee8d81bf04f0381033dfa10dc16e845b4ae00d281e2fa377e48a9f';
        outputFileType = 'mp4';
        break;

      case 'speech':
        if (
          usersFile &&
          !checkFileType(usersFile, ['wav', 'mp3', 'm4a', 'ogg', 'flv'])
        ) {
          await interaction.editReply(
            'Attached file is not valid. (Supported types: wav, mp3, m4a, ogg, or flv)'
          );
          return;
        }

        input = {
          text: usersPrompt,
          speaker: usersFile?.url,
        };

        model =
          'lucataco/xtts-v2:684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e';
        outputFileType = 'wav';
        break;

      default:
        await interaction.editReply(
          `\`${usersChoice}\` is not valid. Please try again or contact the developer.`
        );
        return;
    }

    const output: any = await replicate.run(model, { input });
    let resourceFile: any;

    if (usersChoice === 'music')
      resourceFile = new AttachmentBuilder(output.audio).setName(
        'generated_file.' + outputFileType
      );
    else
      resourceFile = new AttachmentBuilder(output).setName(
        'generated_file.' + outputFileType
      );

    await interaction.followUp({
      content: '*⚠This message can only be viewed once. So save it now. ⚠*',
      files: [resourceFile],
      ephemeral: true,
    });
  },
};

function checkFileType(
  file: CommandInteractionOption<CacheType>['attachment'] | null,
  types: string[]
) {
  if (!file) return false;

  const fileExtension = file.name.split('.').pop();

  for (const type of types) {
    if (fileExtension === type) return true;
  }

  return false;
}

export default command;
