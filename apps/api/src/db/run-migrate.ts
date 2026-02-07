import 'dotenv/config';
import knex from 'knex';
import config from './knexfile.js';

const db = knex(config);

async function run(): Promise<void> {
  const action = process.argv[2] ?? 'latest';

  if (action === 'latest') {
    console.log('Running migrations...');
    const [batch, migrations] = await db.migrate.latest();
    console.log(`Batch ${batch}: ${migrations.length} migrations applied`);
    for (const m of migrations) {
      console.log(`  ✓ ${m}`);
    }
  } else if (action === 'rollback') {
    console.log('Rolling back...');
    const [batch, migrations] = await db.migrate.rollback();
    console.log(`Batch ${batch}: ${migrations.length} rolled back`);
  } else if (action === 'seed') {
    console.log('Running seeds...');
    const [seeds] = await db.seed.run();
    console.log(`${seeds.length} seed files executed`);
    for (const s of seeds) {
      console.log(`  ✓ ${s}`);
    }
  }

  await db.destroy();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
