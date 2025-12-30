/**
 * Hook for managing tree data loading and manipulation
 */
import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { NodeApi } from 'react-arborist';
import { addToast } from '@heroui/react';
import { CaseType } from '@/types/case';
import { FolderType } from '@/types/folder';
import { FilterOptions } from '@/types/filter';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchCases, searchCases, fetchCasesCount, fetchCasesRecursive, updateCase } from '@/utils/caseControl';
import { fetchFolders, updateFolder } from '../../foldersControl';
import { NodeData } from '../types';
import { isFilterEmpty, saveOpenState, findNodeById, updateNodeById } from '../utils';

interface UseTreeDataProps {
  projectId: string;
  filter: FilterOptions;
  onFilterCount?: (count: number) => void;
  updatedCase?: CaseType;
  onCaseUpdated?: (updatedCase: CaseType) => void;
}

export const useTreeData = ({
  projectId,
  filter,
  onFilterCount,
  updatedCase,
  onCaseUpdated,
}: UseTreeDataProps) => {
  const ctx = useContext(TokenContext);
  const [treeData, setTreeData] = useState<NodeData[]>([]);
  const [allFolders, setAllFolders] = useState<FolderType[]>([]);
  const [initialOpenState, setInitialOpenState] = useState<Record<string, boolean>>({});
  const isInitialLoad = useRef(true);
  const prevFilterRef = useRef(filter);

  // Track dependency changes
  const prevCtxRef = useRef(ctx);
  const prevOnFilterCountRef = useRef(onFilterCount);
  const prevOnCaseUpdatedRef = useRef(onCaseUpdated);

  prevCtxRef.current = ctx;
  prevOnFilterCountRef.current = onFilterCount;
  prevOnCaseUpdatedRef.current = onCaseUpdated;

  // Load folders initially - removed to prevent duplicate API calls
  // The filtering effect (line 233) handles initial data loading

  // Load cases into a folder
  const loadFolder = async (folder: NodeData) => {
    if (folder.loaded) return;
    const subFolders = allFolders.filter((f: FolderType) => f.parentFolderId === folder.folderId);
    const fetchedCases = await fetchCases(
      ctx.token.access_token,
      Number(folder.folderId),
      filter.search,
      filter.priorities,
      filter.types,
      filter.tags,
      filter.statuses
    );

    const shouldAutoCheck = folder.checked || false;

    const children: NodeData[] = [
      ...subFolders.map((f: FolderType) => ({
        id: `folder-${f.id}`,
        name: f.name,
        children: [],
        folderId: f.id,
        parentFolderId: f.parentFolderId,
        loaded: false,
        checked: shouldAutoCheck,
        indeterminate: false,
        open: false,
      })),
      ...fetchedCases.map((c: CaseType) => ({
        id: `case-${c.id}`,
        name: c.title,
        isCase: true,
        caseData: c,
        folderId: folder.folderId,
        children: [],
        loaded: true,
        checked: shouldAutoCheck,
      })),
      {
        id: `create-${folder.folderId}`,
        name: 'New Folder',
        isCreateNode: true,
        createParentId: folder.folderId,
        children: [],
        loaded: true,
      },
    ];

    const updateNodes = (nodes: NodeData[]): NodeData[] =>
      nodes.map((n) =>
        n.id === folder.id
          ? { ...n, children, loaded: true }
          : {
              ...n,
              children: updateNodes(n.children),
            }
      );

    setTreeData((prev) => updateNodes(prev));
  };

  // Helper function to recursively load all subfolders
  const loadFolderRecursively = async (folder: NodeData) => {
    if (folder.loaded) return;

    await loadFolder(folder);

    const findAndLoadSubfolders = async (nodes: NodeData[]): Promise<void> => {
      for (const n of nodes) {
        if (n.id === folder.id) {
          for (const child of n.children) {
            if (!child.isCase && !child.isCreateNode) {
              await loadFolderRecursively(child);
            }
          }
          return;
        }
        await findAndLoadSubfolders(n.children);
      }
    };

    setTimeout(async () => {
      await findAndLoadSubfolders(treeData);
    }, 0);
  };

  // Add node to tree locally (without reload)
  const addNodeToParent = (parentFolderId: number, newNode: NodeData) => {
    const updateTree = (nodes: NodeData[]): NodeData[] =>
      nodes.map((n) => {
        if (n.folderId === parentFolderId) {
          const createNodeIndex = n.children.findIndex((c) => c.isCreateNode);
          const newChildren = [...n.children];
          if (createNodeIndex !== -1) {
            newChildren.splice(createNodeIndex, 0, newNode);
          } else {
            newChildren.push(newNode);
          }
          return { ...n, children: newChildren };
        }
        return { ...n, children: updateTree(n.children) };
      });

    setTreeData((prev) => updateTree(prev));
  };

  // Handle rename functionality
  const handleRename = async (nodeId: string, newName: string): Promise<boolean> => {
    const trimmedValue = newName.trim();
    if (!trimmedValue) return false;

    const node = findNodeById(treeData, nodeId);
    if (!node) return false;

    try {
      if (node.isCase && node.caseData) {
        const updatedCaseData = { ...node.caseData, title: trimmedValue };
        await updateCase(ctx.token.access_token, updatedCaseData);

        setTreeData((prev) =>
          updateNodeById(prev, nodeId, (n) => ({
            ...n,
            name: trimmedValue,
            caseData: { ...n.caseData, title: trimmedValue } as CaseType,
          }))
        );
        onCaseUpdated?.(updatedCaseData);
      } else if (node.folderId) {
        await updateFolder(
          ctx.token.access_token,
          node.folderId,
          trimmedValue,
          '',
          projectId,
          node.parentFolderId ?? null
        );

        setTreeData((prev) =>
          updateNodeById(prev, nodeId, (n) => ({ ...n, name: trimmedValue }))
        );
        setAllFolders((prev) =>
          prev.map((f: FolderType) => (f.id === node.folderId ? { ...f, name: trimmedValue } : f))
        );
      }
      return true;
    } catch (error) {
      console.error('Error renaming:', error);
      return false;
    }
  };

  // External case update (from editor)
  useEffect(() => {
    if (!updatedCase) return;

    const recursiveUpdate = (nodes: NodeData[]): NodeData[] =>
      nodes.map((n) => {
        if (n.isCase && n.caseData?.id === updatedCase.id) {
          return { ...n, name: updatedCase.title, caseData: { ...updatedCase } };
        }
        return { ...n, children: recursiveUpdate(n.children) };
      });
    setTreeData((prev) => recursiveUpdate(prev));
    onCaseUpdated?.(updatedCase);
  }, [updatedCase, onCaseUpdated]);

  // Calculate total case count (only when no filters applied)
  useEffect(() => {
    if (!ctx.isSignedIn()) return;
    if (!isFilterEmpty(filter)) return;

    let isCancelled = false;

    const loadTotalCaseCount = async () => {
      const count = await fetchCasesCount(ctx.token.access_token, Number(projectId));
      if (!isCancelled) {
        onFilterCount?.(count);
      }
    };

    loadTotalCaseCount();

    return () => {
      isCancelled = true;
    };
  }, [filter, ctx, projectId, onFilterCount]);

  // Filtering logic
  useEffect(() => {
    const filterChanged = JSON.stringify(prevFilterRef.current) !== JSON.stringify(filter);
    prevFilterRef.current = filter;

    let isCancelled = false;

    if (isFilterEmpty(filter)) {
      if (!isInitialLoad.current && !filterChanged && treeData.length > 0) {
        return;
      }

      const loadFullTree = async () => {
        // Fetch folders if not already loaded
        const folders = allFolders.length > 0
          ? allFolders
          : await fetchFolders(ctx.token.access_token, Number(projectId));

        if (isCancelled) return;

        if (allFolders.length === 0) {
          setAllFolders(folders);
        }

        const roots = folders
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

        if (isCancelled) return;
        setTreeData(roots);

        const loadCasesRecursively = async (nodes: NodeData[]) => {
          for (const node of nodes) {
            if (isCancelled) return;
            if (node.folderId) {
              await loadFolder(node);
              if (node.children.length) await loadCasesRecursively(node.children);
            }
          }
        };

        await loadCasesRecursively(roots);
        isInitialLoad.current = false;
      };

      loadFullTree();
      return () => {
        isCancelled = true;
      };
    }

    const loadFilteredTree = async () => {
      const freshFolders = await fetchFolders(ctx.token.access_token, Number(projectId));
      if (isCancelled) return;

      setAllFolders(freshFolders);

      const cases: CaseType[] = await searchCases(
        ctx.token.access_token,
        Number(projectId),
        filter.search,
        filter.priorities,
        filter.types,
        filter.tags,
        filter.statuses
      );

      if (isCancelled) return;
      onFilterCount?.(cases.length);

      const openStateMap = saveOpenState(treeData);
      const folderMap: Record<number, NodeData> = {};
      const foldersWithCases = new Set<number>();

      // Build folder hierarchy and mark folders that have cases
      cases.forEach((c) => {
        let f = freshFolders.find((f: FolderType) => f.id === c.folderId);
        if (!f) return;

        // Mark this folder as having cases
        foldersWithCases.add(c.folderId!);

        const path: FolderType[] = [];
        while (f) {
          path.unshift(f);
          f = f.parentFolderId !== null ? freshFolders.find((x: FolderType) => x.id === f?.parentFolderId) : undefined;
        }

        let parentNode: NodeData | undefined;
        path.forEach((folder) => {
          if (!folderMap[folder.id]) {
            folderMap[folder.id] = {
              id: `folder-${folder.id}`,
              name: folder.name,
              folderId: folder.id,
              parentFolderId: folder.parentFolderId,
              children: [],
              loaded: true,
              checked: false,
              indeterminate: false,
              open: openStateMap.get(folder.id) ?? false,
            };
          }
          if (parentNode) {
            const exists = parentNode.children.find((c) => c.id === `folder-${folder.id}`);
            if (!exists) parentNode.children.push(folderMap[folder.id]);
          }
          parentNode = folderMap[folder.id];
        });

        parentNode?.children.push({
          id: `case-${c.id}`,
          name: c.title,
          isCase: true,
          caseData: c,
          folderId: c.folderId,
          children: [],
          loaded: true,
        });
      });

      const roots: NodeData[] = [];
      Object.values(folderMap).forEach((node) => {
        if (node.parentFolderId === null) roots.push(node);
      });

      // Only add create nodes to folders that have cases
      Object.values(folderMap).forEach((node) => {
        if (foldersWithCases.has(node.folderId!)) {
          node.children.push({
            id: `create-${node.folderId}`,
            name: 'New Folder',
            isCreateNode: true,
            createParentId: node.folderId,
            children: [],
            loaded: true,
          });
        }
      });

      if (isCancelled) return;
      setTreeData(roots);
    };

    loadFilteredTree();

    return () => {
      isCancelled = true;
    };
  }, [filter, ctx, projectId, onFilterCount]);

  return {
    treeData,
    setTreeData,
    allFolders,
    setAllFolders,
    initialOpenState,
    setInitialOpenState,
    loadFolder,
    loadFolderRecursively,
    addNodeToParent,
    handleRename,
  };
};
