import { Client } from 'discord.js';

export default function (client: Client) {
  const botBuilderText = `
$$$$$$$\             $$\     $$$$$$$\            $$\ $$\       $$\                     
$$  __$$\            $$ |    $$  __$$\           \__|$$ |      $$ |                    
$$ |  $$ | $$$$$$\ $$$$$$\   $$ |  $$ |$$\   $$\ $$\ $$ | $$$$$$$ | $$$$$$\   $$$$$$\  
$$$$$$$\ |$$  __$$\\_$$  _|  $$$$$$$\ |$$ |  $$ |$$ |$$ |$$  __$$ |$$  __$$\ $$  __$$\ 
$$  __$$\ $$ /  $$ | $$ |    $$  __$$\ $$ |  $$ |$$ |$$ |$$ /  $$ |$$$$$$$$ |$$ |  \__|
$$ |  $$ |$$ |  $$ | $$ |$$\ $$ |  $$ |$$ |  $$ |$$ |$$ |$$ |  $$ |$$   ____|$$ |      
$$$$$$$  |\$$$$$$  | \$$$$  |$$$$$$$  |\$$$$$$  |$$ |$$ |\$$$$$$$ |\$$$$$$$\ $$ |      
\_______/  \______/   \____/ \_______/  \______/ \__|\__| \_______| \_______|\__|      
                                                                                       
                                                                                       
                                                                                       
`;

  console.clear();
  console.log(botBuilderText);
  console.log('The future of Discord Bots. Created with ❤ by ItzSanuka.');
  console.log(
    `🤖 BotBuilder is now powering ${client.user?.displayName} (${client.user?.tag})!.`
  );
}
