/**
 * Hook for managing move dialog state and operations
 */
import { useState, useContext } from 'react';
import { addToast } from '@heroui/react';
import { FolderType } from '@/types/folder';
import { TokenContext } from '@/utils/TokenProvider';
import { moveCases } from '@/utils/caseControl';
import { updateFolder } from '../../foldersControl';
import { NodeData } from '../types';
import { uncheckAllNodes } from '../utils';

interface UseMoveDialogProps {
  projectId: string;
  allFolders: FolderType[];
  setAllFolders: React.Dispatch<React.SetStateAction<FolderType[]>>;
  treeData: NodeData[];
  setTreeData: React.Dispatch<React.SetStateAction<NodeData[]>>;
  messages: any;
}

export const useMoveDialog = ({
  projectId,
  allFolders,
  setAllFolders,
  treeData,
  setTreeData,
  messages,
}: UseMoveDialogProps) => {
  const ctx = useContext(TokenContext);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [casesToMove, setCasesToMove] = useState<NodeData[]>([]);
  const [foldersToMove, setFoldersToMove] = useState<NodeData[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<number | undefined>(undefined);
  const [totalCasesInFolders, setTotalCasesInFolders] = useState<number>(0);

  const openMoveDialog = (
    cases: NodeData[],
    folders: NodeData[],
    totalCases: number,
    targetId?: number
  ) => {
    setCasesToMove(cases);
    setFoldersToMove(folders);
    setTotalCasesInFolders(totalCases);
    setTargetFolderId(targetId);
    setIsMoveDialogOpen(true);
  };

  const closeMoveDialog = () => {
    setIsMoveDialogOpen(false);
    setCasesToMove([]);
    setFoldersToMove([]);
    setTotalCasesInFolders(0);
  };

  const handleMoved = async () => {
    if (!targetFolderId) return;

    // Handle folder moves
    if (foldersToMove.length > 0) {
      try {
        for (const folderNode of foldersToMove) {
          if (!folderNode.folderId) continue;

          const folder = allFolders.find((f: FolderType) => f.id === folderNode.folderId);
          if (!folder) continue;

          await updateFolder(
            ctx.token.access_token,
            folderNode.folderId,
            folder.name,
            folder.detail || '',
            projectId,
            targetFolderId
          );
        }

        const folderIds = foldersToMove.map((f) => f.folderId).filter((id): id is number => id !== undefined);
        setAllFolders((prev) =>
          prev.map((f: FolderType) => (folderIds.includes(f.id) ? { ...f, parentFolderId: targetFolderId } : f))
        );

        const removeFolders = (nodes: NodeData[]): NodeData[] =>
          nodes
            .map((n) => ({ ...n, children: removeFolders(n.children) }))
            .filter((n) => n.folderId !== undefined && !folderIds.includes(n.folderId));

        const findTargetNode = (nodes: NodeData[]): NodeData | null => {
          for (const n of nodes) {
            if (n.folderId === targetFolderId) return n;
            const found = findTargetNode(n.children);
            if (found) return found;
          }
          return null;
        };

        const targetNode = findTargetNode(treeData);

        const addToTargetFolder = (nodes: NodeData[]): NodeData[] =>
          nodes.map((n) => {
            if (n.folderId === targetFolderId) {
              if (!n.loaded) {
                return n;
              }

              const createNodeIndex = n.children.findIndex((c) => c.isCreateNode);
              const newFolders: NodeData[] = foldersToMove.map((folderNode) => {
                const folder = allFolders.find((f: FolderType) => f.id === folderNode.folderId);
                return {
                  id: `folder-${folderNode.folderId}`,
                  name: folder?.name || folderNode.name,
                  children: [],
                  folderId: folderNode.folderId!,
                  parentFolderId: targetFolderId,
                  loaded: false,
                  checked: false,
                  indeterminate: false,
                  open: false,
                };
              });

              const newChildren = [...n.children];
              if (createNodeIndex !== -1) {
                newChildren.splice(createNodeIndex, 0, ...newFolders);
              } else {
                newChildren.push(...newFolders);
              }

              return { ...n, children: newChildren };
            }
            return { ...n, children: addToTargetFolder(n.children) };
          });

        if (targetNode?.loaded) {
          setTreeData((prev) => addToTargetFolder(removeFolders(prev)));
        } else {
          setTreeData((prev) => removeFolders(prev));
        }

        setTreeData((prev) => uncheckAllNodes(prev));
      } catch (error) {
        console.error('Error moving folders:', error);
        addToast({
          title: 'Error',
          color: 'danger',
          description: error instanceof Error ? error.message : 'Failed to move folders',
        });
        return;
      }

      addToast({
        title: 'Success',
        color: 'success',
        description: 'Folders moved successfully',
      });

      closeMoveDialog();
      return;
    }

    // Handle case moves
    const caseIds = casesToMove.map((c) => c.caseData?.id).filter((id): id is number => id !== undefined);
    const success = await moveCases(ctx.token.access_token, caseIds, targetFolderId, Number(projectId));
    if (!success) {
      addToast({
        title: 'Error',
        color: 'danger',
        description: 'Failed to move test cases',
      });
      return;
    }

    const movedCases = casesToMove
      .filter((c) => c.caseData)
      .map((c) => ({
        ...c,
        folderId: targetFolderId,
        id: `case-${c.caseData?.id}`,
        name: c.caseData?.title || '',
        isCase: true,
        children: [],
        loaded: true,
        checked: false,
        indeterminate: false,
      }));

    const removeNodes = (nodes: NodeData[]): NodeData[] =>
      nodes
        .map((n) => ({ ...n, children: removeNodes(n.children) }))
        .filter((n) => !caseIds.includes(n.caseData?.id ?? -1));

    const addToTargetFolder = (nodes: NodeData[]): NodeData[] =>
      nodes.map((n) => {
        if (n.folderId === targetFolderId) {
          const existingCases = n.children.filter((child) => child.isCase);
          const nonCaseChildren = n.children.filter((child) => !child.isCase);
          const newCases = movedCases.filter(
            (mc) => !existingCases.some((ec) => ec.caseData?.id === mc.caseData?.id)
          );
          return {
            ...n,
            children: [...nonCaseChildren, ...existingCases, ...newCases],
            loaded: true,
          };
        }
        return { ...n, children: addToTargetFolder(n.children) };
      });

    setTreeData((prev) => addToTargetFolder(removeNodes(prev)));
    setTreeData((prev) => uncheckAllNodes(prev));

    addToast({
      title: 'Success',
      color: 'success',
      description: messages.casesMoved,
    });

    closeMoveDialog();
  };

  return {
    isMoveDialogOpen,
    casesToMove,
    foldersToMove,
    targetFolderId,
    totalCasesInFolders,
    openMoveDialog,
    closeMoveDialog,
    handleMoved,
    setCasesToMove,
    setFoldersToMove,
    setTargetFolderId,
    setTotalCasesInFolders,
  };
};
