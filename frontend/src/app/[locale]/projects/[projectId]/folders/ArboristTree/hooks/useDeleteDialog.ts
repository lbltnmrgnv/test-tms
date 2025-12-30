/**
 * Hook for managing delete dialog state and operations
 */
import { useState, useContext, useEffect } from 'react';
import { addToast } from '@heroui/react';
import { FolderType } from '@/types/folder';
import { TokenContext } from '@/utils/TokenProvider';
import { deleteCases } from '@/utils/caseControl';
import { deleteFolder, fetchFolders } from '../../foldersControl';
import { NodeData } from '../types';
import { getCheckedItems } from '../utils';

interface UseDeleteDialogProps {
  projectId: string;
  treeData: NodeData[];
  setTreeData: React.Dispatch<React.SetStateAction<NodeData[]>>;
  setAllFolders: React.Dispatch<React.SetStateAction<FolderType[]>>;
  triggerBulkDelete?: boolean;
  onBulkDeleteComplete?: () => void;
}

export const useDeleteDialog = ({
  projectId,
  treeData,
  setTreeData,
  setAllFolders,
  triggerBulkDelete,
  onBulkDeleteComplete,
}: UseDeleteDialogProps) => {
  const ctx = useContext(TokenContext);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [casesToDelete, setCasesToDelete] = useState<NodeData[]>([]);
  const [foldersToDelete, setFoldersToDelete] = useState<NodeData[]>([]);
  const [totalCasesInDeleteFolders, setTotalCasesInDeleteFolders] = useState<number>(0);

  const openDeleteDialog = (cases: NodeData[], folders: NodeData[], totalCases: number) => {
    setCasesToDelete(cases);
    setFoldersToDelete(folders);
    setTotalCasesInDeleteFolders(totalCases);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setCasesToDelete([]);
    setFoldersToDelete([]);
    setTotalCasesInDeleteFolders(0);
  };

  const handleDeleteConfirmed = async () => {
    try {
      // Handle folder deletion
      if (foldersToDelete.length > 0) {
        for (const folderNode of foldersToDelete) {
          if (!folderNode.folderId) continue;
          await deleteFolder(ctx.token.access_token, folderNode.folderId);
        }

        const folderIds = foldersToDelete.map((f) => f.folderId).filter((id): id is number => id !== undefined);
        const removeNodes = (nodes: NodeData[]): NodeData[] =>
          nodes
            .map((n) => ({ ...n, children: removeNodes(n.children) }))
            .filter((n) => n.folderId !== undefined && !folderIds.includes(n.folderId));

        setTreeData((prev) => removeNodes(prev));
        setAllFolders((prev) => prev.filter((f: FolderType) => !folderIds.includes(f.id)));

        addToast({
          title: 'Success',
          color: 'success',
          description: `${foldersToDelete.length} ${foldersToDelete.length === 1 ? 'folder' : 'folders'} deleted successfully`,
        });
      }
      // Handle case deletion
      else if (casesToDelete.length > 0) {
        const caseIds = casesToDelete.map((c) => c.caseData?.id).filter((id): id is number => id !== undefined);
        await deleteCases(ctx.token.access_token, caseIds, Number(projectId));

        const removeNodes = (nodes: NodeData[]): NodeData[] =>
          nodes
            .map((n) => ({ ...n, children: removeNodes(n.children) }))
            .filter((n) => !caseIds.includes(n.caseData?.id ?? -1));

        setTreeData((prev) => removeNodes(prev));

        addToast({
          title: 'Success',
          color: 'success',
          description: `${casesToDelete.length} ${casesToDelete.length === 1 ? 'test case' : 'test cases'} deleted successfully`,
        });
      }
    } catch (error) {
      console.error('Error deleting:', error);
      addToast({
        title: 'Error',
        color: 'danger',
        description: error instanceof Error ? error.message : 'Failed to delete',
      });
    }
  };

  // Handle bulk delete trigger
  useEffect(() => {
    if (!triggerBulkDelete) return;

    const performBulkDelete = async () => {
      const { cases: checkedCases, folders: checkedFolders } = getCheckedItems(treeData);

      try {
        // Handle folder deletion
        if (checkedFolders.length > 0) {
          for (const folderNode of checkedFolders) {
            if (!folderNode.folderId) continue;
            await deleteFolder(ctx.token.access_token, folderNode.folderId);
          }
        }

        // Handle case deletion
        if (checkedCases.length > 0) {
          const caseIds = checkedCases.map((c) => c.caseData?.id).filter((id): id is number => id !== undefined);
          await deleteCases(ctx.token.access_token, caseIds, Number(projectId));
        }

        // RELOAD tree from server
        const freshFolders = await fetchFolders(ctx.token.access_token, Number(projectId));
        setAllFolders(freshFolders);

        const roots = freshFolders
          .filter((f: FolderType) => f.parentFolderId === null)
          .map((f: FolderType) => ({
            id: `folder-${f.id}`,
            name: f.name,
            folderId: f.id,
            parentFolderId: null,
            children: [],
            loaded: false,
            checked: false,
            indeterminate: false,
            open: false,
          }));
        setTreeData(roots);

        const totalDeleted = checkedCases.length + checkedFolders.length;
        addToast({
          title: 'Success',
          color: 'success',
          description: `Successfully deleted ${totalDeleted} ${totalDeleted === 1 ? 'item' : 'items'}`,
        });
      } catch (error) {
        console.error('Error in bulk delete:', error);
        addToast({
          title: 'Error',
          color: 'danger',
          description: error instanceof Error ? error.message : 'Failed to delete selected items',
        });
      }

      onBulkDeleteComplete?.();
    };

    performBulkDelete();
  }, [triggerBulkDelete, treeData, ctx, projectId, onBulkDeleteComplete]);

  return {
    isDeleteDialogOpen,
    casesToDelete,
    foldersToDelete,
    totalCasesInDeleteFolders,
    openDeleteDialog,
    closeDeleteDialog,
    handleDeleteConfirmed,
    setCasesToDelete,
    setFoldersToDelete,
    setTotalCasesInDeleteFolders,
  };
};
