import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromProjectId } = editableMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);

  // Set up association for eager loading
  Case.belongsTo(Folder, { foreignKey: 'folderId' });

  router.post('/bulkrestore', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    const { caseIds } = req.body;
    const projectId = req.query.projectId;

    if (!caseIds || !Array.isArray(caseIds)) {
      return res.status(400).send('Invalid caseIds array');
    }

    if (!projectId) {
      return res.status(400).send('projectId is required');
    }

    const transaction = await sequelize.transaction();

    try {
      // Fetch all cases to be restored
      const casesToRestore = await Case.findAll({
        where: { id: caseIds, isDeleted: true },
        transaction
      });

      if (casesToRestore.length === 0) {
        await transaction.commit();
        return res.status(204).send();
      }

      // Collect cases that need folder reassignment
      const casesNeedingReassignment = [];
      const folderIds = [...new Set(casesToRestore.map(c => c.folderId))];

      // Check which folders exist
      const existingFolders = await Folder.findAll({
        where: { id: folderIds },
        attributes: ['id'],
        transaction
      });

      const existingFolderIds = new Set(existingFolders.map(f => f.id));

      // Identify cases with missing folders
      for (const testCase of casesToRestore) {
        if (!existingFolderIds.has(testCase.folderId)) {
          casesNeedingReassignment.push(testCase.id);
        }
      }

      // If there are cases with missing folders, move them to root folder
      if (casesNeedingReassignment.length > 0) {
        // Find or create root folder for the project
        let rootFolder = await Folder.findOne({
          where: {
            projectId,
            parentFolderId: null
          },
          transaction
        });

        if (!rootFolder) {
          // No root folder exists, try to find any folder in the project
          rootFolder = await Folder.findOne({
            where: { projectId },
            transaction
          });

          if (!rootFolder) {
            // Create a root folder if none exists
            rootFolder = await Folder.create({
              name: 'Root',
              detail: 'Auto-created root folder',
              projectId,
              parentFolderId: null
            }, { transaction });
          }
        }

        // Bulk update folderId for orphaned cases
        await Case.update(
          { folderId: rootFolder.id },
          {
            where: { id: casesNeedingReassignment },
            transaction
          }
        );
      }

      // Now restore all cases
      await Case.update(
        { isDeleted: false },
        {
          where: { id: caseIds, isDeleted: true },
          transaction
        }
      );

      await transaction.commit();
      res.status(204).send();
    } catch (error) {
      await transaction.rollback();
      console.error('Error restoring cases:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
