/**
 * Utility functions for ArboristTree
 */
import { FolderType } from '@/types/folder';
import { FilterOptions } from '@/types/filter';
import { NodeData } from './types';

/**
 * Check if filter is empty
 */
export const isFilterEmpty = (filter: FilterOptions): boolean => {
  return (
    !filter.search?.trim() &&
    (!filter.priorities || filter.priorities.length === 0) &&
    (!filter.types || filter.types.length === 0) &&
    (!filter.tags || filter.tags.length === 0) &&
    (!filter.statuses || filter.statuses.length === 0)
  );
};

/**
 * Check if a folder is a descendant of another folder
 */
export const isFolderDescendant = (
  folderId: number,
  potentialAncestorId: number,
  allFolders: FolderType[]
): boolean => {
  let currentFolder = allFolders.find((f: FolderType) => f.id === folderId);
  while (currentFolder) {
    if (currentFolder.parentFolderId === potentialAncestorId) {
      return true;
    }
    currentFolder = allFolders.find((f: FolderType) => f.id === currentFolder?.parentFolderId);
  }
  return false;
};

/**
 * Count selected items (folders and cases)
 */
export const countSelectedItems = (nodes: NodeData[]): number => {
  let count = 0;
  for (const n of nodes) {
    if (n.checked && !n.isCreateNode) {
      count++;
    }
    count += countSelectedItems(n.children);
  }
  return count;
};

/**
 * Count selected cases only (excluding folders)
 */
export const countSelectedCases = (nodes: NodeData[]): number => {
  let count = 0;
  for (const n of nodes) {
    if (n.checked && n.isCase && !n.isCreateNode) {
      count++;
    }
    count += countSelectedCases(n.children);
  }
  return count;
};

/**
 * Find a node by ID in the tree
 */
export const findNodeById = (nodes: NodeData[], nodeId: string): NodeData | null => {
  for (const n of nodes) {
    if (n.id === nodeId) return n;
    const found = findNodeById(n.children, nodeId);
    if (found) return found;
  }
  return null;
};

/**
 * Update a node in the tree by ID
 */
export const updateNodeById = (
  nodes: NodeData[],
  nodeId: string,
  updater: (node: NodeData) => NodeData
): NodeData[] => {
  return nodes.map((n) =>
    n.id === nodeId ? updater(n) : { ...n, children: updateNodeById(n.children, nodeId, updater) }
  );
};

/**
 * Remove nodes by IDs from tree
 */
export const removeNodesById = (nodes: NodeData[], idsToRemove: (string | number)[]): NodeData[] => {
  return nodes
    .map((n) => ({ ...n, children: removeNodesById(n.children, idsToRemove) }))
    .filter((n) => {
      // Check if node should be removed
      if (n.caseData?.id && idsToRemove.includes(n.caseData.id)) return false;
      if (n.folderId && idsToRemove.includes(n.folderId)) return false;
      return true;
    });
};

/**
 * Uncheck all nodes in tree
 */
export const uncheckAllNodes = (nodes: NodeData[]): NodeData[] => {
  return nodes.map((n) => ({
    ...n,
    checked: false,
    indeterminate: false,
    children: uncheckAllNodes(n.children),
  }));
};

/**
 * Save open state of all nodes
 */
export const saveOpenState = (nodes: NodeData[]): Map<number, boolean> => {
  const openStateMap = new Map<number, boolean>();

  const traverse = (nodes: NodeData[]) => {
    nodes.forEach((n) => {
      if (n.folderId) openStateMap.set(n.folderId, n.open ?? false);
      if (n.children.length) traverse(n.children);
    });
  };

  traverse(nodes);
  return openStateMap;
};

/**
 * Get all checked items from tree, separating cases and folders
 */
export const getCheckedItems = (
  nodes: NodeData[],
  parentChecked = false
): { cases: NodeData[]; folders: NodeData[] } => {
  let cases: NodeData[] = [];
  let folders: NodeData[] = [];

  for (const n of nodes) {
    if (n.isCreateNode) {
      continue;
    }

    if (!n.checked) {
      const childResult = getCheckedItems(n.children, false);
      cases = cases.concat(childResult.cases);
      folders = folders.concat(childResult.folders);
      continue;
    }

    // Node is checked
    if (parentChecked) {
      continue;
    }

    // Collect this top-level checked item
    if (n.isCase && n.caseData) {
      cases.push(n);
    } else if (n.folderId) {
      folders.push(n);
    }
  }

  return { cases, folders };
};
