import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineFolder from '../../models/folders.js';
import defineCase from '../../models/cases.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromFolderId } = editableMiddleware(sequelize);
  const Folder = defineFolder(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);

  // Recursive function to get all child folder IDs
  async function getAllChildFolderIds(folderId) {
    const childFolders = await Folder.findAll({
      where: { parentFolderId: folderId },
      attributes: ['id'],
    });

    let allChildIds = childFolders.map(folder => folder.id);

    // Recursively get children of each child folder
    for (const childFolder of childFolders) {
      const nestedChildIds = await getAllChildFolderIds(childFolder.id);
      allChildIds = allChildIds.concat(nestedChildIds);
    }

    return allChildIds;
  }

  router.delete('/:folderId', verifySignedIn, verifyProjectDeveloperFromFolderId, async (req, res) => {
    const folderId = req.params.folderId;
    try {
      const folder = await Folder.findByPk(folderId);
      if (!folder) {
        return res.status(404).send('Folder not found');
      }

      // Get all child folder IDs recursively
      const childFolderIds = await getAllChildFolderIds(folderId);

      // Include the parent folder itself in the list
      const allFolderIds = [parseInt(folderId), ...childFolderIds];

      // Disable foreign key constraints to prevent CASCADE from physically deleting soft-deleted cases
      await sequelize.query('PRAGMA foreign_keys = OFF');

      try {
        // Soft-delete all test cases in these folders
        await Case.update(
          { isDeleted: true },
          { where: { folderId: allFolderIds, isDeleted: false } }
        );

        // Now hard-delete the folder (CASCADE will delete child folders)
        await folder.destroy();
      } finally {
        // Always re-enable foreign key constraints
        await sequelize.query('PRAGMA foreign_keys = ON');
      }

      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
