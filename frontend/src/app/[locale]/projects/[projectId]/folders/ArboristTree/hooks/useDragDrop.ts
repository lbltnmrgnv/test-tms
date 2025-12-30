/**
 * Hook for managing drag and drop operations
 */
import { useRef, useContext } from 'react';
import { NodeApi } from 'react-arborist';
import { FolderType } from '@/types/folder';
import { CaseType } from '@/types/case';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchCasesRecursive } from '@/utils/caseControl';
import { NodeData } from '../types';
import { isFolderDescendant } from '../utils';

interface UseDragDropProps {
  treeData: NodeData[];
  allFolders: FolderType[];
  onMoveDialogOpen: (
    cases: NodeData[],
    folders: NodeData[],
    totalCases: number,
    targetId?: number
  ) => void;
}

export const useDragDrop = ({ treeData, allFolders, onMoveDialogOpen }: UseDragDropProps) => {
  const ctx = useContext(TokenContext);
  const nodesMapRef = useRef<Record<number, NodeApi<NodeData>>>({});

  const handleMove = async ({
    dragIds,
    parentNode,
  }: {
    dragIds: string[];
    parentNode: NodeApi<NodeData> | null;
  }) => {
    if (!parentNode?.data.folderId) return;
    const targetId = parentNode.data.folderId;

    // Determine if dragging a folder or cases
    const draggedNodes = dragIds
      .map((id) => {
        if (id.startsWith('folder-')) {
          const folderId = Number(id.replace('folder-', ''));
          return { id, isFolder: true, folderId };
        } else if (id.startsWith('case-')) {
          const caseId = Number(id.replace('case-', ''));
          return { id, isFolder: false, node: nodesMapRef.current[caseId]?.data };
        }
        return null;
      })
      .filter(Boolean);

    const draggedFolder = draggedNodes.find((n) => n && n.isFolder);

    if (draggedFolder) {
      // Handle folder move
      const getCheckedFolders = (nodes: NodeData[]): NodeData[] => {
        let folders: NodeData[] = [];
        for (const n of nodes) {
          if (!n.isCase && n.checked && n.folderId) {
            folders.push(n);
          }
          folders = folders.concat(getCheckedFolders(n.children));
        }
        return folders;
      };

      const checkedFolders = getCheckedFolders(treeData);
      const foldersToMove =
        checkedFolders.length > 0
          ? checkedFolders
          : [draggedNodes.find((n) => n && n.isFolder && n.folderId)]
              .map((n) => {
                if (!n) return null;
                const findFolderNode = (nodes: NodeData[]): NodeData | null => {
                  for (const node of nodes) {
                    if (node.id === `folder-${n.folderId}`) return node;
                    const found = findFolderNode(node.children);
                    if (found) return found;
                  }
                  return null;
                };
                return findFolderNode(treeData);
              })
              .filter((n): n is NodeData => n !== null);

      // Validate all folders
      for (const folder of foldersToMove) {
        if (!folder.folderId) continue;

        if (folder.folderId === targetId) {
          console.warn('Cannot move folder into itself');
          return;
        }

        if (isFolderDescendant(targetId, folder.folderId, allFolders)) {
          console.warn('Cannot move folder into its own descendant');
          return;
        }
      }

      // Calculate total cases in all folders
      let totalCases = 0;
      for (const folder of foldersToMove) {
        if (folder.folderId) {
          const cases = await fetchCasesRecursive(ctx.token.access_token, folder.folderId);
          totalCases += cases.length;
        }
      }

      onMoveDialogOpen([], foldersToMove, totalCases, targetId);
      return;
    }

    // Handle case move
    const getCheckedCasesAndFolders = (
      nodes: NodeData[]
    ): {
      cases: NodeData[];
      unloadedFolderIds: number[];
    } => {
      let cases: NodeData[] = [];
      let unloadedFolderIds: number[] = [];

      for (const n of nodes) {
        if (n.isCase && n.checked) {
          cases.push(n);
        } else if (!n.isCase && n.checked && !n.loaded && n.folderId) {
          unloadedFolderIds.push(n.folderId);
        }

        const childResult = getCheckedCasesAndFolders(n.children);
        cases = cases.concat(childResult.cases);
        unloadedFolderIds = unloadedFolderIds.concat(childResult.unloadedFolderIds);
      }

      return { cases, unloadedFolderIds };
    };

    const { cases: selectedCases, unloadedFolderIds } = getCheckedCasesAndFolders(treeData);

    // Fetch cases from unloaded folders recursively
    const recursiveCases: CaseType[] = [];
    for (const folderId of unloadedFolderIds) {
      const cases = await fetchCasesRecursive(ctx.token.access_token, folderId);
      recursiveCases.push(...cases);
    }

    const recursiveNodes: NodeData[] = recursiveCases.map((c) => ({
      id: `case-${c.id}`,
      name: c.title,
      isCase: true,
      caseData: c,
      folderId: c.folderId,
      children: [],
      loaded: true,
      checked: true,
    }));

    const dragCases = dragIds
      .map((id) => nodesMapRef.current[Number(id.replace('case-', ''))]?.data)
      .filter(Boolean);
    const allSelectedCases = [...selectedCases, ...recursiveNodes];
    const finalCases = allSelectedCases.length ? allSelectedCases : dragCases;
    if (!finalCases.length) return;

    onMoveDialogOpen(finalCases, [], 0, targetId);
  };

  return {
    handleMove,
    nodesMapRef,
  };
};
