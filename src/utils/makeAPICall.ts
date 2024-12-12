import 'dotenv/config';
import checkEnvVariables from './checkEnvVariables.js';

export enum Location {
  MinecraftServerStats = 1,
  NamelessMC,
}

export async function makeAPICall(
  location: Location,
  endpoint: string,
  options?: RequestInit
): Promise<Response> {
  let baseURL = '';
  const missingVariables = checkEnvVariables();

  switch (location) {
    case 1:
      baseURL = 'https://api.mcsrvstat.us';
      break;

    case 2:
      if (missingVariables.includes('namelessMC'))
        throw new Error('Missing API URL/Key from NamelessMC.');
      baseURL = process.env.NAMELESSMC_API_URL!;
      break;
  }

  const apiURL = baseURL + endpoint;

  return await fetch(apiURL, options);
}
