function defineCase(sequelize, DataTypes) {
  const Case = sequelize.define('Case', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    state: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    automationStatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    template: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    preConditions: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expectedResults: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    folderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'folder',
        key: 'id',
      },
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    tableName: 'cases',
  });

  Case.associate = (models) => {
    Case.belongsTo(models.Folder, {
      foreignKey: 'folderId',
    });
    Case.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'Creator',
    });
    Case.belongsTo(models.User, {
      foreignKey: 'assignedTo',
      as: 'Assignee',
    });
    Case.belongsToMany(models.Step, {
      through: 'caseSteps',
    });
    Case.belongsToMany(models.Tags, {
      through: 'caseTags',
      foreignKey: 'caseId',
      otherKey: 'tagId',
    });
  };

  return Case;
}

export default defineCase;
