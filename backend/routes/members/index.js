import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineUser from '../../models/users.js';
import defineMember from '../../models/members.js';
import defineProject from '../../models/projects.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);
  const User = defineUser(sequelize, DataTypes);
  const Member = defineMember(sequelize, DataTypes);
  const Project = defineProject(sequelize, DataTypes);
  Member.belongsTo(User, { foreignKey: 'userId' });
  Project.belongsTo(User, { foreignKey: 'userId' });

  router.get('/', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    try {
      // Get project owner
      const project = await Project.findByPk(projectId, {
        include: [
          {
            model: User,
            attributes: ['id', 'email', 'username', 'avatarPath'],
          },
        ],
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get project members
      const members = await Member.findAll({
        where: {
          projectId: projectId,
        },
        include: [
          {
            model: User,
            attributes: ['id', 'email', 'username', 'avatarPath'],
          },
        ],
      });

      // Combine owner and members, formatting consistently
      const allMembers = [
        {
          id: null,
          userId: project.User.id,
          projectId: parseInt(projectId),
          role: 0, // Owner role
          User: project.User,
          isOwner: true,
        },
        ...members.map((member) => ({
          ...member.toJSON(),
          isOwner: false,
        })),
      ];

      res.json(allMembers);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
