import 'dotenv/config';

const HOST = process.env.TESTRAIL_HOST!;
const USERNAME = process.env.TESTRAIL_USERNAME!;
const API_KEY = process.env.TESTRAIL_API_KEY!;

export async function addSection(
  projectId: number,
  suiteId: number,
  name: string,
  parentId?: number
) {
  const url = `${HOST}/index.php?/api/v2/add_section/${projectId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(
        `${USERNAME}:${API_KEY}`
      ).toString('base64')}`,
    },
    body: JSON.stringify({
      suite_id: suiteId,
      name,
      parent_id: parentId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `TestRail API failed: ${response.status} ${error}`
    );
  }

  return response.json();
}