import { addSection } from './testrail-api';

async function main() {
  const sectionName = process.argv[2];

  if (!sectionName) {
    console.log('Usage: npx tsx run-lifecycle.ts "Section Name"');
    process.exit(1);
  }

  const projectId = 1;
  const suiteId = 1;

  console.log(`Creating TestRail section: ${sectionName}`);

  const section = await addSection(
    projectId,
    suiteId,
    sectionName
  );

  console.log(`Section created successfully.`);
  console.log(`ID: ${section.id}`);
  console.log(`Name: ${section.name}`);
}

main().catch(error => {
  console.error('Failed:', error.message);
  process.exit(1);
});