import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import createTempDataFile from "#utils/createTempDataFile.js";
import {
  createAudioPlayer,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioResource,
} from "@discordjs/voice";
import { ApplicationCommandOptionType, ChannelType } from "discord.js";
import path from "path";

const gemini = Gemini();

const command: CommandType = {
  name: "assistant-join",
  description: "Join a VC & listen for your request.",
  isDisabled: true || !gemini.enabled, //!WIP
  isGuildOnly: true,
  options: [
    {
      name: "channel",
      description: "The voice channel you are at",
      type: ApplicationCommandOptionType.Channel,
      channel_types: [ChannelType.GuildVoice],
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    const welcomeMessages: { message: string; voice: string }[] = [
      {
        message: `Hey ${interaction.user.displayName}, how can I help you today?`,
        voice: "achernar",
      },
      {
        message: `Hi ${interaction.user.displayName}, ready to get started?`,
        voice: "achird",
      },
      {
        message: `Welcome back ${interaction.user.displayName}! What are we working on?`,
        voice: "algenib",
      },
      {
        message: `Yo ${interaction.user.displayName}, what's up?`,
        voice: "algieba",
      },
      {
        message: `Heyo ${interaction.user.displayName}, need a hand with something?`,
        voice: "alnilam",
      },
      {
        message: `Greetings ${interaction.user.displayName}, let's dive in!`,
        voice: "aoede",
      },
      {
        message: `Hey ${interaction.user.displayName}, what’s on your mind today?`,
        voice: "autonoe",
      },
      {
        message: `Hello ${interaction.user.displayName}! How can I assist you?`,
        voice: "callirrhoe",
      },
      {
        message: `Hiya ${interaction.user.displayName}, you caught me mid-process—what’s up?`,
        voice: "charon",
      },
      {
        message: `What's crackin', ${interaction.user.displayName}?`,
        voice: "despina",
      },
      {
        message: `Hey ${interaction.user.displayName}, I’m all ears.`,
        voice: "enceladus",
      },
      {
        message: `Salutations, ${interaction.user.displayName}. What can I do for you?`,
        voice: "erinome",
      },
      {
        message: `Hey ${interaction.user.displayName}, ready to unleash some magic?`,
        voice: "fenrir",
      },
      {
        message: `Ahoy ${interaction.user.displayName}! What are we building today?`,
        voice: "gacrux",
      },
      {
        message: `Good to see you, ${interaction.user.displayName}. Let’s get to it.`,
        voice: "iapetus",
      },
      {
        message: `Hola ${interaction.user.displayName}, how can I serve you today?`,
        voice: "kore",
      },
      {
        message: `Hey ${interaction.user.displayName}, what mission are we tackling?`,
        voice: "laomedeia",
      },
      {
        message: `Hey there ${interaction.user.displayName}! Need some bot-powered brilliance?`,
        voice: "leda",
      },
      {
        message: `Sup ${interaction.user.displayName}? Got something for me?`,
        voice: "orus",
      },
      {
        message: `Hey ${interaction.user.displayName}, let’s make something epic.`,
        voice: "puck",
      },
      {
        message: `Hi ${interaction.user.displayName}, the code gods are listening.`,
        voice: "pulcherrima",
      },
      {
        message: `Hello hello, ${interaction.user.displayName}. How may I assist?`,
        voice: "rasalgethi",
      },
      {
        message: `Greetings ${interaction.user.displayName}, let’s make tech happen.`,
        voice: "sadachbia",
      },
      {
        message: `Yo ${interaction.user.displayName}, curious minds unite!`,
        voice: "sadaltager",
      },
      {
        message: `Hi ${interaction.user.displayName}, what genius idea are we cooking today?`,
        voice: "schedar",
      },
      {
        message: `Hey ${interaction.user.displayName}, let’s kick things off.`,
        voice: "sulafat",
      },
      {
        message: `Hello ${interaction.user.displayName}, got commands for me?`,
        voice: "umbriel",
      },
      {
        message: `Hey ${interaction.user.displayName}, your digital genie is here.`,
        voice: "vindemiatrix",
      },
      {
        message: `Hey ${interaction.user.displayName}, how may I serve your quest?`,
        voice: "zephyr",
      },
      {
        message: `Hi ${interaction.user.displayName}, always a pleasure.`,
        voice: "zubenelgenubi",
      },
      {
        message: `Welcome ${interaction.user.displayName}, I’m warmed up and ready.`,
        voice: "achernar",
      },
      {
        message: `Hey ${interaction.user.displayName}, ready to disrupt something?`,
        voice: "achird",
      },
      {
        message: `Hi ${interaction.user.displayName}, throw me a challenge!`,
        voice: "algenib",
      },
      {
        message: `Hello ${interaction.user.displayName}, let’s activate the awesomeness.`,
        voice: "algieba",
      },
      {
        message: `Hey ${interaction.user.displayName}, I’ve been waiting for you.`,
        voice: "alnilam",
      },
      {
        message: `Hey ${interaction.user.displayName}, what’s our goal today?`,
        voice: "aoede",
      },
      {
        message: `What’s happening, ${interaction.user.displayName}?`,
        voice: "autonoe",
      },
      {
        message: `Hey ${interaction.user.displayName}, shall we begin?`,
        voice: "callirrhoe",
      },
      {
        message: `Hi ${interaction.user.displayName}, ready to bot like a boss?`,
        voice: "charon",
      },
      {
        message: `Hey ${interaction.user.displayName}, your wish is my command.`,
        voice: "despina",
      },
      {
        message: `Hello ${interaction.user.displayName}, fire away!`,
        voice: "enceladus",
      },
      {
        message: `Yo ${interaction.user.displayName}, let’s light up the logs.`,
        voice: "erinome",
      },
      {
        message: `Hey ${interaction.user.displayName}, need help decoding something?`,
        voice: "fenrir",
      },
      {
        message: `Hi ${interaction.user.displayName}, let’s hack some brilliance.`,
        voice: "gacrux",
      },
      {
        message: `Welcome ${interaction.user.displayName}, prepared to collaborate?`,
        voice: "iapetus",
      },
      {
        message: `Hey ${interaction.user.displayName}, let's make some noise.`,
        voice: "kore",
      },
      {
        message: `Hi ${interaction.user.displayName}, back for more fun?`,
        voice: "laomedeia",
      },
      {
        message: `Hey ${interaction.user.displayName}, what are we solving today?`,
        voice: "leda",
      },
      {
        message: `Yo ${interaction.user.displayName}, what’s next on our adventure?`,
        voice: "orus",
      },
      {
        message: `Hello ${interaction.user.displayName}, feeling creative?`,
        voice: "puck",
      },
      {
        message: `Hey ${interaction.user.displayName}, let’s go build something awesome.`,
        voice: "pulcherrima",
      },
      {
        message: `Greetings ${interaction.user.displayName}, got any bright ideas today?`,
        voice: "rasalgethi",
      },
      {
        message: `Hi ${interaction.user.displayName}, I’m tuned in.`,
        voice: "sadachbia",
      },
      {
        message: `Hey ${interaction.user.displayName}, command center activated.`,
        voice: "sadaltager",
      },
      {
        message: `Hello ${interaction.user.displayName}, my circuits are yours.`,
        voice: "schedar",
      },
      {
        message: `What’s good, ${interaction.user.displayName}?`,
        voice: "sulafat",
      },
      {
        message: `Hey ${interaction.user.displayName}, let the fun begin.`,
        voice: "umbriel",
      },
      {
        message: `Hi ${interaction.user.displayName}, let’s interface.`,
        voice: "vindemiatrix",
      },
      {
        message: `Welcome ${interaction.user.displayName}, ready to innovate?`,
        voice: "zephyr",
      },
      {
        message: `Hey ${interaction.user.displayName}, spark something cool.`,
        voice: "zubenelgenubi",
      },
      {
        message: `Hello ${interaction.user.displayName}, your assistant is live.`,
        voice: "achernar",
      },
      {
        message: `Yo ${interaction.user.displayName}, ideas brewing?`,
        voice: "achird",
      },
      {
        message: `Hi ${interaction.user.displayName}, let's make this chat unforgettable.`,
        voice: "algenib",
      },
      {
        message: `Hey ${interaction.user.displayName}, ready to remix reality?`,
        voice: "algieba",
      },
      {
        message: `Welcome back ${interaction.user.displayName}, always a pleasure.`,
        voice: "alnilam",
      },
      {
        message: `Hello ${interaction.user.displayName}, primed and listening.`,
        voice: "aoede",
      },
      {
        message: `Hi ${interaction.user.displayName}, tech buddy activated.`,
        voice: "autonoe",
      },
      {
        message: `Yo ${interaction.user.displayName}, got a blueprint in mind?`,
        voice: "callirrhoe",
      },
      {
        message: `Hey ${interaction.user.displayName}, what’s the challenge today?`,
        voice: "charon",
      },
      {
        message: `Hi ${interaction.user.displayName}, let’s turn ideas into action.`,
        voice: "despina",
      },
      {
        message: `Hello ${interaction.user.displayName}, the assistant is online.`,
        voice: "enceladus",
      },
      {
        message: `Hey ${interaction.user.displayName}, ready to code some greatness?`,
        voice: "erinome",
      },
      {
        message: `Welcome ${interaction.user.displayName}, let’s get creative.`,
        voice: "fenrir",
      },
      {
        message: `Yo ${interaction.user.displayName}, bot is ready for duty.`,
        voice: "gacrux",
      },
      {
        message: `Hi ${interaction.user.displayName}, shall we collaborate?`,
        voice: "iapetus",
      },
      {
        message: `Hey ${interaction.user.displayName}, voice recognized—what’s next?`,
        voice: "kore",
      },
      {
        message: `Hello ${interaction.user.displayName}, computing awesomeness...`,
        voice: "laomedeia",
      },
      {
        message: `Hi ${interaction.user.displayName}, I’m synced up and standing by.`,
        voice: "leda",
      },
      {
        message: `Greetings ${interaction.user.displayName}, what wonders await us?`,
        voice: "orus",
      },
      {
        message: `Hey ${interaction.user.displayName}, I’m booted and brilliant.`,
        voice: "puck",
      },
      {
        message: `Yo ${interaction.user.displayName}, let’s make Discord proud.`,
        voice: "pulcherrima",
      },
      {
        message: `Hi ${interaction.user.displayName}, show me your genius.`,
        voice: "rasalgethi",
      },
      {
        message: `Welcome ${interaction.user.displayName}, interface initialized.`,
        voice: "sadachbia",
      },
      {
        message: `Hello ${interaction.user.displayName}, tell me everything.`,
        voice: "sadaltager",
      },
      {
        message: `Hey ${interaction.user.displayName}, let’s command the future.`,
        voice: "schedar",
      },
      {
        message: `Yo ${interaction.user.displayName}, let the ideas flow.`,
        voice: "sulafat",
      },
      {
        message: `Hi ${interaction.user.displayName}, what’s the plan today?`,
        voice: "umbriel",
      },
      {
        message: `Greetings ${interaction.user.displayName}, let's innovate together.`,
        voice: "vindemiatrix",
      },
      {
        message: `Hey ${interaction.user.displayName}, let's get productive.`,
        voice: "zephyr",
      },
      {
        message: `Hello ${interaction.user.displayName}, your voice has been detected.`,
        voice: "zubenelgenubi",
      },
      {
        message: `Hi ${interaction.user.displayName}, eager to assist.`,
        voice: "achernar",
      },
      {
        message: `Yo ${interaction.user.displayName}, let's spark some thoughts.`,
        voice: "achird",
      },
      {
        message: `Welcome back ${interaction.user.displayName}, what’s new?`,
        voice: "algenib",
      },
      {
        message: `Hey ${interaction.user.displayName}, ready to unleash your creativity?`,
        voice: "algieba",
      },
      {
        message: `Hi ${interaction.user.displayName}, systems go.`,
        voice: "alnilam",
      },
      {
        message: `Hello ${interaction.user.displayName}, thinking caps on!`,
        voice: "aoede",
      },
      {
        message: `Hey ${interaction.user.displayName}, you talk—I execute.`,
        voice: "autonoe",
      },
      {
        message: `Yo ${interaction.user.displayName}, plans, plots, or puzzles today?`,
        voice: "callirrhoe",
      },
      {
        message: `Hi ${interaction.user.displayName}, open mic for brilliance.`,
        voice: "charon",
      },
      {
        message: `Hey ${interaction.user.displayName}, synced and dialed in.`,
        voice: "despina",
      },
      {
        message: `Welcome ${interaction.user.displayName}, infinite possibilities await.`,
        voice: "enceladus",
      },
      {
        message: `Hello ${interaction.user.displayName}, ready to voice-control the world?`,
        voice: "erinome",
      },
    ];
    const { message: welcomeMessage, voice: assistantVoice } =
      welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

    try {
      const voiceChannel = interaction.options.getChannel("channel", true);

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guildId!,
        adapterCreator: interaction.guild!.voiceAdapterCreator,
        selfDeaf: false,
      });

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        connection.on(VoiceConnectionStatus.Ready, resolve);
        connection.on(VoiceConnectionStatus.Disconnected, reject);
        connection.on(VoiceConnectionStatus.Destroyed, reject);

        setTimeout(() => reject(new Error("Connection timeout")), 10000);
      });

      const audioPlayer = createAudioPlayer();
      const subscription = connection.subscribe(audioPlayer);

      if (!subscription) {
        connection.destroy();
        throw new Error("Failed to subscribe audio player to connection.");
      }

      const response = await gemini.model!.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [
          {
            parts: [
              {
                text: welcomeMessage,
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: assistantVoice },
            },
          },
        },
      });

      const data =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!data) {
        connection.destroy();
        throw new Error("Failed to get data for welcome message.");
      }

      const audioBuffer = Buffer.from(data, "base64");
      const tempAudioFile = `assistant-welcome-${interaction.user.id}.wav`;

      // Use the updated createTempDataFile with audio support
      await createTempDataFile(tempAudioFile, audioBuffer, 60000, {
        isAudio: true,
      });

      // Get the full path to the temp file
      const tempFilePath = path.join(process.cwd(), "temp", tempAudioFile);

      const welcomeResource = createAudioResource(tempFilePath);
      audioPlayer.play(welcomeResource);

      // Wait for playback to complete or timeout
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(void 0);
        }, 5000);

        audioPlayer.once(AudioPlayerStatus.Idle, () => {
          clearTimeout(timeout);
          resolve(void 0);
        });
      });

      await interaction.followUp(
        `✅ Joined voice channel and played greeting message.`
      );
    } catch (error) {
      console.error("Error in assistant-join command:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(
          `❌ Failed to join voice channel: ${errorMessage}`
        );
      } else {
        await interaction.reply(
          `❌ Failed to join voice channel: ${errorMessage}`
        );
      }
    }
  },
};

export default command;
