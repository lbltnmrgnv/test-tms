import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineFolder from '../../models/folders.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromFolderId } = editableMiddleware(sequelize);
  const Folder = defineFolder(sequelize, DataTypes);

  // Recursive function to check if targetId is a descendant of folderId
  async function isDescendant(folderId, targetId) {
    if (!targetId) {
      return false;
    }

    if (folderId === targetId) {
      return true;
    }

    const targetFolder = await Folder.findByPk(targetId);
    if (!targetFolder || !targetFolder.parentFolderId) {
      return false;
    }

    return isDescendant(folderId, targetFolder.parentFolderId);
  }

  router.put('/:folderId', verifySignedIn, verifyProjectDeveloperFromFolderId, async (req, res) => {
    const folderId = req.params.folderId;
    const { name, detail, projectId, parentFolderId } = req.body;
    try {
      const folder = await Folder.findByPk(folderId);
      if (!folder) {
        return res.status(404).send('Folder not found');
      }

      // Validate circular dependency before updating
      if (parentFolderId) {
        // Check if folder is being moved into itself
        if (folderId === parentFolderId) {
          return res.status(400).send('Cannot move folder into itself');
        }

        // Check if target parent is a descendant of the folder being moved
        const isCircular = await isDescendant(folderId, parentFolderId);
        if (isCircular) {
          return res.status(400).send('Cannot move folder into its own descendant');
        }
      }

      await folder.update({
        name,
        detail,
        projectId,
        parentFolderId,
      });
      res.json(folder);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
