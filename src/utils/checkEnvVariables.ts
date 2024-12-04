import 'dotenv/config';

export default function checkEnvVariables() {
  if (
    !process.env.APP_TOKEN ||
    !process.env.NAMELESSMC_API_URL ||
    !process.env.NAMELESSMC_API_KEY ||
    !process.env.REPLICATE_API_TOKEN
  ) {
    console.log('Missing environment variable(s). Check your .env file.');
    process.exit(1);
  }
}
