function defineStep(sequelize, DataTypes) {
  const Step = sequelize.define('Step', {
    step: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    result: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    parentStepId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'steps',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  });

  Step.associate = (models) => {
    Step.belongsToMany(models.Case, {
      through: 'caseSteps',
    });

    // Self-referential associations for hierarchical structure
    Step.hasMany(Step, {
      as: 'substeps',
      foreignKey: 'parentStepId',
      onDelete: 'CASCADE',
    });

    Step.belongsTo(Step, {
      as: 'parentStep',
      foreignKey: 'parentStepId',
    });
  };

  return Step;
}

export default defineStep;
