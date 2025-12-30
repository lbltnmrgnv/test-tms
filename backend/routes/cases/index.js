import express from 'express';

const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import defineCase from '../../models/cases.js';
import defineTag from '../../models/tags.js';

import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import defineFolder from '../../models/folders.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromFolderId, verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Tags = defineTag(sequelize, DataTypes);

  Case.belongsToMany(Tags, { through: 'caseTags', foreignKey: 'caseId', otherKey: 'tagId' });
  Tags.belongsToMany(Case, { through: 'caseTags', foreignKey: 'tagId', otherKey: 'caseId' });

  router.get('/', verifySignedIn, verifyProjectVisibleFromFolderId, async (req, res) => {
    const { folderId, search, priority, type, tag } = req.query;

    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    try {
      const whereClause = {
        folderId: folderId,
        isDeleted: false,
      };

      if (search) {
        const searchTerm = search.trim();

        if (searchTerm.length > 100) {
          return res.status(400).json({ error: 'too long search param' });
        }

        if (searchTerm.length >= 1) {
          whereClause[Op.or] = [
            { title: { [Op.like]: `%${searchTerm}%` } },
            { description: { [Op.like]: `%${searchTerm}%` } },
          ];
        }
      }

      if (priority) {
        const priorityValues = priority
          .split(',')
          .map((p) => parseInt(p.trim(), 10))
          .filter((p) => !isNaN(p));
        if (priorityValues.length > 0) {
          whereClause.priority = { [Op.in]: priorityValues };
        }
      }

      if (type) {
        const typeValues = type
          .split(',')
          .map((t) => parseInt(t.trim(), 10))
          .filter((t) => !isNaN(t));
        if (typeValues.length > 0) {
          whereClause.type = { [Op.in]: typeValues };
        }
      }

      const tagInclude = {
        model: Tags,
        attributes: ['id', 'name'],
        through: { attributes: [] },
      };

      if (tag) {
        const tagIds = tag
          .split(',')
          .map((t) => parseInt(t.trim(), 10))
          .filter((t) => !isNaN(t));

        if (tagIds.length > 0) {
          tagInclude.where = { id: { [Op.in]: tagIds } };
          tagInclude.required = true;
        }
      }

      const cases = await Case.findAll({
        where: whereClause,
        include: [tagInclude],
      });
      res.json(cases);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  router.get('/count', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    try {
      const folders = await Folder.findAll({ where: { projectId } });
      const folderIds = folders.map(f => f.id);

      if (!folderIds.length) return res.json({ count: 0 });

      const count = await Case.count({
        where: { folderId: { [Op.in]: folderIds }, isDeleted: false },
      });

      res.json({ count });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  router.get('/search', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    const { projectId, search, priority, type, tag, isDeleted } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    try {
      const folders = await Folder.findAll({ where: { projectId } });
      const folderIds = folders.map(f => f.id);

      if (!folderIds.length) return res.json([]);

      // Parse isDeleted parameter
      let isDeletedFilter = false; // default
      if (isDeleted === 'true') {
        isDeletedFilter = true;
      } else if (isDeleted === 'false') {
        isDeletedFilter = false;
      }

      const whereClause = {
        folderId: { [Op.in]: folderIds },
        isDeleted: isDeletedFilter,
      };

      if (search) {
        const searchTerm = search.trim().slice(0, 100);
        if (searchTerm.length > 0) {
          whereClause[Op.or] = [
            { title: { [Op.like]: `%${searchTerm}%` } },
            { description: { [Op.like]: `%${searchTerm}%` } },
          ];
        }
      }

      if (priority) {
        const values = priority.split(',').map(Number).filter(Number.isFinite);
        if (values.length) whereClause.priority = { [Op.in]: values };
      }

      if (type) {
        const values = type.split(',').map(Number).filter(Number.isFinite);
        if (values.length) whereClause.type = { [Op.in]: values };
      }

      const tagInclude = {
        model: Tags,
        attributes: ['id', 'name'],
        through: { attributes: [] },
      };

      if (tag) {
        const tagIds = tag.split(',').map(Number).filter(Number.isFinite);
        if (tagIds.length) {
          tagInclude.where = { id: { [Op.in]: tagIds } };
          tagInclude.required = true;
        }
      }

      const cases = await Case.findAll({
        where: whereClause,
        include: [tagInclude],
      });

      res.json(cases);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  router.get('/recursive', verifySignedIn, verifyProjectVisibleFromFolderId, async (req, res) => {
    const { folderId } = req.query;

    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    try {
      // Recursive function to collect all descendant folder IDs
      const collectDescendantFolderIds = async (parentId) => {
        const childFolders = await Folder.findAll({
          where: { parentFolderId: parentId },
          attributes: ['id'],
        });

        let allIds = [parentId];

        for (const childFolder of childFolders) {
          const childIds = await collectDescendantFolderIds(childFolder.id);
          allIds = allIds.concat(childIds);
        }

        return allIds;
      };

      // Collect all folder IDs including the root folder and all descendants
      const folderIds = await collectDescendantFolderIds(parseInt(folderId, 10));

      // Find all cases in these folders
      const cases = await Case.findAll({
        where: {
          folderId: { [Op.in]: folderIds },
          isDeleted: false,
        },
        include: [
          {
            model: Tags,
            attributes: ['id', 'name'],
            through: { attributes: [] },
          },
        ],
      });

      res.json(cases);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
