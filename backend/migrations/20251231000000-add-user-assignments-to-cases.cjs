module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('cases');

    // Only add createdBy column if it doesn't already exist
    if (!tableDescription.createdBy) {
      await queryInterface.addColumn('cases', 'createdBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // Only add assignedTo column if it doesn't already exist
    if (!tableDescription.assignedTo) {
      await queryInterface.addColumn('cases', 'assignedTo', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('cases');

    // Only remove assignedTo column if it exists
    if (tableDescription.assignedTo) {
      await queryInterface.removeColumn('cases', 'assignedTo');
    }

    // Only remove createdBy column if it exists
    if (tableDescription.createdBy) {
      await queryInterface.removeColumn('cases', 'createdBy');
    }
  }
};
