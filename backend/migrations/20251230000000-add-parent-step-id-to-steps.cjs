module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('steps');

    // Only add the column if it doesn't already exist
    if (!tableDescription.parentStepId) {
      await queryInterface.addColumn('steps', 'parentStepId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'steps',
          key: 'id',
        },
        onDelete: 'CASCADE',
      });
    }
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('steps');

    // Only remove the column if it exists
    if (tableDescription.parentStepId) {
      await queryInterface.removeColumn('steps', 'parentStepId');
    }
  }
};
