import * as dotenv from 'dotenv';

dotenv.config();

const host = process.env.TESTRAIL_HOST;
const username = process.env.TESTRAIL_USERNAME;
const apiKey = process.env.TESTRAIL_API_KEY;

async function verifyConnection() {
    const credentials = Buffer
        .from(`${username}:${apiKey}`)
        .toString('base64');

    const endpoint = `${host}/index.php?/api/v2/get_current_user`;

    const response = await fetch(endpoint, {
        headers: {
            'Authorization': `Basic ${credentials}`
        }
    });

    const payload = await response.json() as { email: string };

    console.log(`Connection verified for: ${payload.email}`);
}

verifyConnection();