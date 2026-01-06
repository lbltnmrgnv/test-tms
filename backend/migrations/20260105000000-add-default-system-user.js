import bcrypt from 'bcrypt';

export async function up(queryInterface, Sequelize) {
  try {
    console.log('Checking if users exist in the database...');

    // Check if any users exist
    const users = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM users',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const userCount = users[0].count;
    console.log(`Current user count: ${userCount}`);

    // Only create default user if no users exist
    if (userCount === 0) {
      console.log('No users found. Creating default system user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);

      await queryInterface.bulkInsert('users', [
        {
          email: 'admin@system.local',
          password: hashedPassword,
          username: 'System Admin',
          role: 0, // Administrator role
          avatar_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      // Verify user was created
      const verifyUsers = await queryInterface.sequelize.query(
        'SELECT id, email, username FROM users WHERE email = ?',
        {
          replacements: ['admin@system.local'],
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      if (verifyUsers.length > 0) {
        console.log('✓ Default system user created successfully!');
        console.log(`  User ID: ${verifyUsers[0].id}`);
        console.log(`  Email: ${verifyUsers[0].email}`);
        console.log(`  Username: ${verifyUsers[0].username}`);
        console.log('  Password: admin123');
        console.log('IMPORTANT: Change this password immediately after first login!');
      } else {
        console.error('✗ Failed to verify user creation!');
      }
    } else {
      console.log('Users already exist. Skipping default user creation.');
    }
  } catch (error) {
    console.error('Error in add-default-system-user migration:', error);
    throw error;
  }
}

export async function down(queryInterface, Sequelize) {
  // Remove the default system user
  await queryInterface.bulkDelete('users', {
    email: 'admin@system.local',
  });
}
