export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('cases', 'isDeleted', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('cases', 'isDeleted');
}
