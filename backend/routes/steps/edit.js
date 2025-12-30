import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineStep from '../../models/steps.js';
import defineCaseStep from '../../models/caseSteps.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const Step = defineStep(sequelize, DataTypes);
  const CaseStep = defineCaseStep(sequelize, DataTypes);
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromCaseId } = editableMiddleware(sequelize);

  router.post('/update', verifySignedIn, verifyProjectDeveloperFromCaseId, async (req, res) => {
    const caseId = req.query.caseId;
    const steps = req.body;
    const t = await sequelize.transaction();

    const createStep = async (step) => {
      const newStep = await Step.create(
        {
          step: step.step,
          result: step.result,
          parentStepId: step.parentStepId || null,
        },
        { transaction: t }
      );
      await CaseStep.create(
        {
          caseId: caseId,
          stepId: newStep.id,
          stepNo: step.caseSteps.stepNo,
        },
        { transaction: t }
      );
      return newStep;
    };

    const deleteStep = async (step) => {
      await CaseStep.destroy({
        where: { stepId: step.id },
        transaction: t,
      });
      await Step.destroy({
        where: { id: step.id },
        transaction: t,
      });
      return null;
    };

    const updateStep = async (step) => {
      await Step.update(step, {
        where: { id: step.id },
        transaction: t,
      });
      await CaseStep.update(
        {
          stepNo: step.caseSteps.stepNo,
        },
        {
          where: { stepId: step.id },
          transaction: t,
        }
      );
      return step;
    };
    try {
      // Map to track temporary IDs -> real database IDs
      const idMap = new Map();

      // Separate steps by operation type
      const stepsToDelete = steps.filter(step => step.editState === 'deleted');
      const stepsToUpdate = steps.filter(step => step.editState === 'changed');
      const stepsToCreate = steps.filter(step => step.editState === 'new');
      const stepsNotChanged = steps.filter(step => step.editState === 'notChanged');

      // Helper function to sort steps for hierarchical creation
      const sortStepsForCreation = (stepsArray) => {
        const sorted = [];
        const processed = new Set();
        const queue = [...stepsArray];

        while (queue.length > 0) {
          const remainingCount = queue.length;

          for (let i = queue.length - 1; i >= 0; i--) {
            const step = queue[i];
            // A step can be processed if it has no parent or its parent has been processed
            if (!step.parentStepId || processed.has(step.parentStepId)) {
              sorted.push(step);
              processed.add(step.id);
              queue.splice(i, 1);
            }
          }

          // If no progress was made, we have orphaned steps or circular dependencies
          if (queue.length === remainingCount && queue.length > 0) {
            // Process remaining steps without parent references to avoid infinite loop
            queue.forEach(step => {
              sorted.push({ ...step, parentStepId: null });
              processed.add(step.id);
            });
            break;
          }
        }

        return sorted;
      };

      // Process deletions first
      await Promise.all(stepsToDelete.map(step => deleteStep(step)));

      // Process updates (existing steps with real IDs)
      const updatedSteps = await Promise.all(stepsToUpdate.map(step => updateStep(step)));

      // Sort new steps to ensure parents are created before children
      const sortedNewSteps = sortStepsForCreation(stepsToCreate);

      // Create new steps sequentially to handle parent-child relationships
      const createdSteps = [];
      for (const step of sortedNewSteps) {
        // Replace temporary parentStepId with real ID if it exists in the map
        let parentStepId = step.parentStepId;
        if (parentStepId !== null && parentStepId !== undefined) {
          if (idMap.has(parentStepId)) {
            // Replace with real ID
            parentStepId = idMap.get(parentStepId);
          } else if (typeof parentStepId === 'number' && parentStepId >= 0) {
            // If it's a temporary ID that hasn't been created yet, set to null
            parentStepId = null;
          }
        }

        const stepToCreate = {
          ...step,
          parentStepId: parentStepId || null
        };

        const newStep = await createStep(stepToCreate);

        // Map the temporary ID to the real database ID
        if (step.id !== undefined && step.id !== null) {
          idMap.set(step.id, newStep.id);
        }

        createdSteps.push(newStep);
      }

      // Combine all results
      const results = [
        ...stepsNotChanged,
        ...updatedSteps,
        ...createdSteps
      ];

      await t.commit();
      res.json(results.filter((result) => result !== null));
    } catch (error) {
      console.error(error);
      await t.rollback();
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
