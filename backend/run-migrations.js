import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databasePath = path.resolve(__dirname, 'database/database.sqlite');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: databasePath,
  logging: console.log
});

const queryInterface = sequelize.getQueryInterface();

// Ensure SequelizeMeta table exists
await sequelize.query(`
  CREATE TABLE IF NOT EXISTS SequelizeMeta (
    name VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY
  );
`);

// Get executed migrations
const [executedMigrations] = await sequelize.query('SELECT name FROM SequelizeMeta ORDER BY name ASC');
const executedNames = executedMigrations.map(m => m.name);

// Get all migration files
const migrationsDir = path.resolve(__dirname, 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.js'))
  .sort();

console.log(`Found ${migrationFiles.length} migration files`);
console.log(`Already executed: ${executedNames.length} migrations`);

// Run pending migrations
for (const file of migrationFiles) {
  if (!executedNames.includes(file)) {
    console.log(`\nRunning migration: ${file}`);
    const migration = await import(`./migrations/${file}`);
    
    try {
      await migration.up(queryInterface, Sequelize);
      await sequelize.query('INSERT INTO SequelizeMeta (name) VALUES (?)', {
        replacements: [file]
      });
      console.log(`✓ Migration ${file} completed successfully`);
    } catch (error) {
      console.error(`✗ Migration ${file} failed:`, error.message);
      throw error;
    }
  } else {
    console.log(`⊘ Skipping already executed migration: ${file}`);
  }
}

console.log('\nAll migrations completed successfully');
await sequelize.close();
