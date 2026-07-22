const { Client } = require('pg');
async function fix() {
  const client = new Client({ connectionString: "postgresql://postgres.zxphtedyezcnoibjhlcw:zbWNhwKjwjizh3sz@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
  await client.connect();
  console.log('Connected');
  try {
    await client.query(`TRUNCATE TABLE chat_participants CASCADE;`);
    console.log('Truncated chat_participants');
  } catch(e) { console.error(e); }
  finally { await client.end(); }
}
fix();
