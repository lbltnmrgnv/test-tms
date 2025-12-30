export async function up(queryInterface, Sequelize) {
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

export async function down(queryInterface) {
  await queryInterface.removeColumn('steps', 'parentStepId');
}
