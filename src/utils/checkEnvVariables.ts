import 'dotenv/config';

export default function checkEnvVariables() {
  if (!process.env.APP_TOKEN) {
    console.log('Missing environment variable(s). Check your .env file.');
    process.exit(1);
  }
}
