import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: 5432,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function getTables() {
  try {
    await client.connect();
    console.log('[v0] Connected to database');

    // Get all tables in public schema
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n[v0] Tables in Supabase database:');
    console.log('=====================================');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    
    console.log(`\n[v0] Total tables: ${result.rows.length}`);

    // Get detailed schema for each table
    console.log('\n[v0] Table Details:');
    console.log('=====================================');
    
    for (const row of result.rows) {
      const tableName = row.table_name;
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      console.log(`\n${tableName}:`);
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '✓' : '✗';
        console.log(`  - ${col.column_name} (${col.data_type}) [Nullable: ${nullable}]`);
      });
    }

    await client.end();
  } catch (error) {
    console.error('[v0] Error:', error.message);
    process.exit(1);
  }
}

getTables();
