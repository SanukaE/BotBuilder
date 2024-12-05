import 'dotenv/config';

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

  switch (location) {
    case 1:
      baseURL = 'https://api.mcsrvstat.us';
      break;

    case 2:
      baseURL = process.env.NAMELESSMC_API_URL!;
      break;
  }

  const apiURL = baseURL + endpoint;

  return await fetch(apiURL, options);
}
