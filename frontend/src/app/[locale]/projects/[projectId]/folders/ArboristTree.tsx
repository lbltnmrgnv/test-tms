/**
 * ArboristTree - Tree component for folders and test cases with drag-and-drop support
 */
'use client';
import { useState, useEffect, useContext, useRef } from 'react';
import { Tree, NodeApi } from 'react-arborist';
import { Folder, ChevronRight, ChevronDown, Bot, Hand, Plus } from 'lucide-react';
import { addToast } from '@heroui/react';
import { CaseType, CasesMessages } from '@/types/case';
import { FilterOptions } from '@/types/filter';
import { FolderType } from '@/types/folder';
import CaseDialog from '@/src/app/[locale]/projects/[projectId]/folders/[folderId]/cases/CaseMoveDialog';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchCases, moveCases, searchCases, createCase, fetchCasesCount, deleteCases, updateCase, fetchCasesRecursive } from '@/utils/caseControl';
import { fetchFolders, createFolder, deleteFolder, updateFolder } from './foldersControl';

type CreateMode = 'folder' | 'case';

interface NodeData {
  id: string;
  name: string;
  children: NodeData[];
  isCase?: boolean;
  caseData?: CaseType;
  folderId?: number;
  loaded?: boolean;
  parentFolderId?: number | null;
  checked?: boolean;
  indeterminate?: boolean;
  open?: boolean;
  isCreateNode?: boolean;
  createParentId?: number;
}

interface Props {
  projectId: string;
  messages: CasesMessages;
  selectedCaseId?: number;
  onCaseClick?: (caseData: CaseType) => void;
  onCaseUpdated?: (updatedCase: CaseType) => void;
  filter?: FilterOptions;
  onFilterCount?: (count: number) => void;
  updatedCase?: CaseType; // External update from editor
}

export default function ArboristTree({
  projectId,
  messages,
  selectedCaseId,
  onCaseClick,
  onCaseUpdated,
  filter = {},
  onFilterCount,
  updatedCase,
}: Props) {
  const ctx = useContext(TokenContext);
  const [treeData, setTreeData] = useState<NodeData[]>([]);
  const [allFolders, setAllFolders] = useState<FolderType[]>([]);
  const nodesMapRef = useRef<Record<number, NodeApi<NodeData>>>({});
  const treeRef = useRef<any>(null);

  // Save the open state of nodes for initialOpenState
  const [initialOpenState, setInitialOpenState] = useState<Record<string, boolean>>({});

  // Check if filter is empty
  const isFilterEmpty = (filter: FilterOptions): boolean => {
    return (
      !filter.search?.trim() &&
      (!filter.priorities || filter.priorities.length === 0) &&
      (!filter.types || filter.types.length === 0) &&
      (!filter.tags || filter.tags.length === 0)
    );
  };

  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [casesToMove, setCasesToMove] = useState<NodeData[]>([]);
  const [foldersToMove, setFoldersToMove] = useState<NodeData[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<number | undefined>(undefined);
  const [totalCasesInFolders, setTotalCasesInFolders] = useState<number>(0);

  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const [treeHeight, setTreeHeight] = useState<number>(0);
  const [treeWidth, setTreeWidth] = useState(0);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: NodeApi<NodeData> | null;
  }>({ visible: false, x: 0, y: 0, node: null });
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Tree dimensions
  useEffect(() => {
    if (!treeContainerRef.current) return;
    const container = treeContainerRef.current;
    const update = () => {
      setTreeHeight(container.offsetHeight);
      setTreeWidth(container.offsetWidth);
    };
    requestAnimationFrame(update);

    // Use ResizeObserver to track container size changes
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);

    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      resizeObserver.disconnect();
    };
  }, []);

  // Load folders
  useEffect(() => {
    if (!ctx.isSignedIn()) return;
    fetchFolders(ctx.token.access_token, Number(projectId)).then((folders) => {
      setAllFolders(folders);
      const roots = folders
        .filter((f: FolderType) => f.parentFolderId === null)
        .map((f: FolderType) => ({
          id: `folder-${f.id}`,
          name: f.name,
          children: [],
          folderId: f.id,
          parentFolderId: null,
          loaded: false,
          checked: false,
          indeterminate: false,
          open: false,
        }));
      setTreeData(roots);
    });
  }, [projectId, ctx]);

  // Load cases into a folder
  const loadFolder = async (folder: NodeData) => {
    if (folder.loaded) return; // Don't reload if already loaded
    const subFolders = allFolders.filter((f) => f.parentFolderId === folder.folderId);
    const fetchedCases = await fetchCases(ctx.token.access_token, Number(folder.folderId));

    // Determine if children should be automatically checked
    const shouldAutoCheck = folder.checked || false;

    const children: NodeData[] = [
      ...subFolders.map((f) => ({
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
      // Add create node at the end
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

  // Add node to tree locally (without reload)
  const addNodeToParent = (parentFolderId: number, newNode: NodeData) => {
    const updateTree = (nodes: NodeData[]): NodeData[] =>
      nodes.map((n) => {
        if (n.folderId === parentFolderId) {
          // Find create-node and insert new node before it
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

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, node: NodeApi<NodeData>) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't show context menu for create nodes
    if (node.data.isCreateNode) return;

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  const handleContextSelect = () => {
    if (contextMenu.node) {
      toggleCheck(contextMenu.node);
    }
    closeContextMenu();
  };

  const handleContextRename = () => {
    if (contextMenu.node) {
      setIsRenaming(contextMenu.node.data.id);
      setRenameValue(contextMenu.node.data.name);
    }
    closeContextMenu();
  };

  const handleContextMove = async () => {
    if (!contextMenu.node) return;

    if (contextMenu.node.data.isCase) {
      // Move case
      setCasesToMove([contextMenu.node.data]);
      setFoldersToMove([]);
      setTotalCasesInFolders(0);
      setTargetFolderId(undefined);
      setIsMoveDialogOpen(true);
    } else if (contextMenu.node.data.folderId) {
      // Move folder
      const folderId = contextMenu.node.data.folderId;
      const recursiveCases = await fetchCasesRecursive(ctx.token.access_token, folderId);

      setCasesToMove([]);
      setFoldersToMove([contextMenu.node.data]);
      setTotalCasesInFolders(recursiveCases.length);
      setTargetFolderId(undefined);
      setIsMoveDialogOpen(true);
    }
    closeContextMenu();
  };

  const handleContextDelete = async () => {
    if (!contextMenu.node) return;

    const node = contextMenu.node;
    closeContextMenu();

    try {
      if (node.data.isCase && node.data.caseData) {
        // Delete case
        await deleteCases(ctx.token.access_token, [node.data.caseData.id], Number(projectId));

        // Remove from tree
        const removeNode = (nodes: NodeData[]): NodeData[] =>
          nodes
            .map((n) => ({ ...n, children: removeNode(n.children) }))
            .filter((n) => n.id !== node.data.id);

        setTreeData((prev) => removeNode(prev));
      } else if (node.data.folderId) {
        // Delete folder
        await deleteFolder(ctx.token.access_token, node.data.folderId);

        // Remove from tree and allFolders
        const removeNode = (nodes: NodeData[]): NodeData[] =>
          nodes
            .map((n) => ({ ...n, children: removeNode(n.children) }))
            .filter((n) => n.id !== node.data.id);

        setTreeData((prev) => removeNode(prev));
        setAllFolders((prev) => prev.filter((f) => f.id !== node.data.folderId));
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleRenameSubmit = async () => {
    if (!isRenaming || !renameValue.trim()) {
      setIsRenaming(null);
      return;
    }

    const nodeId = isRenaming;
    const trimmedValue = renameValue.trim();

    // Find the node in tree
    const findNode = (nodes: NodeData[]): NodeData | null => {
      for (const n of nodes) {
        if (n.id === nodeId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(treeData);
    if (!node) {
      setIsRenaming(null);
      return;
    }

    try {
      if (node.isCase && node.caseData) {
        // Update case title via API
        const updatedCase = { ...node.caseData, title: trimmedValue };
        await updateCase(ctx.token.access_token, updatedCase);

        // Update in tree
        const updateNode = (nodes: NodeData[]): NodeData[] =>
          nodes.map((n) =>
            n.id === nodeId
              ? { ...n, name: trimmedValue, caseData: { ...n.caseData, title: trimmedValue } as CaseType }
              : { ...n, children: updateNode(n.children) }
          );

        setTreeData((prev) => updateNode(prev));
        onCaseUpdated?.(updatedCase);
      } else if (node.folderId) {
        // Update folder via API
        await updateFolder(
          ctx.token.access_token,
          node.folderId,
          trimmedValue,
          '',
          projectId,
          node.parentFolderId ?? null
        );

        // Update in tree
        const updateNode = (nodes: NodeData[]): NodeData[] =>
          nodes.map((n) =>
            n.id === nodeId ? { ...n, name: trimmedValue } : { ...n, children: updateNode(n.children) }
          );

        setTreeData((prev) => updateNode(prev));
        setAllFolders((prev) =>
          prev.map((f) => (f.id === node.folderId ? { ...f, name: trimmedValue } : f))
        );
      }
    } catch (error) {
      console.error('Error renaming:', error);
    }

    setIsRenaming(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsRenaming(null);
      setRenameValue('');
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (contextMenu.visible) {
      const handleClickOutside = () => closeContextMenu();
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  // Node click handler
  const handleClick = async (node: NodeApi<NodeData>) => {
    console.log('[ArboristTree] handleClick:', {
      nodeId: node.data.id,
      isCase: node.data.isCase,
      isOpen: node.isOpen
    });

    if (node.data.isCase && node.data.caseData) {
      console.log('[ArboristTree] Clicking on case, NOT toggling tree');
      onCaseClick?.(node.data.caseData);
      return;
    }

    // For folders - toggle with state preservation via Tree API
    console.log('[ArboristTree] Toggling folder:', node.data.id);
    node.toggle();

    // Save the open state of nodes after toggle
    if (treeRef.current) {
      const newOpenState: Record<string, boolean> = {};
      treeRef.current.visibleNodes.forEach((n: NodeApi<NodeData>) => {
        if (!n.data.isCase) {
          newOpenState[n.data.id] = n.isOpen;
        }
      });
      setInitialOpenState(newOpenState);
    }

    await loadFolder(node.data);
  };

  // External case update (from editor)
  useEffect(() => {
    if (!updatedCase) return;
    console.log('[ArboristTree] updatedCase changed:', updatedCase.id, updatedCase.title);

    // Save current open state before update
    if (treeRef.current) {
      const currentOpenState: Record<string, boolean> = {};
      treeRef.current.visibleNodes.forEach((n: NodeApi<NodeData>) => {
        if (!n.data.isCase) {
          currentOpenState[n.data.id] = n.isOpen;
        }
      });
      setInitialOpenState(currentOpenState);
    }

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

  // Checkboxes
  const toggleCheck = async (node: NodeApi<NodeData>) => {
    const newState = !node.data.checked;

    // Recursively update state of all loaded child nodes
    const updateChildren = (nodes: NodeData[], state: boolean): NodeData[] =>
      nodes.map((n) => ({
        ...n,
        checked: state,
        indeterminate: false,
        children: updateChildren(n.children, state),
      }));

    // Apply update to target node and its loaded children
    const applyUpdate = (nodes: NodeData[]): NodeData[] =>
      nodes.map((n) => {
        if (n.id === node.data.id) {
          return {
            ...n,
            checked: newState,
            indeterminate: false,
            children: updateChildren(n.children, newState),
          };
        }

        return {
          ...n,
          children: applyUpdate(n.children),
        };
      });

    // Update parent nodes state (indeterminate/checked)
    const updateParents = (nodes: NodeData[]): NodeData[] => {
      const process = (n: NodeData): NodeData => {
        if (!n.children.length) return n;

        const children = n.children.map(process);
        const allChecked = children.every((c) => c.checked);
        const noneChecked = children.every((c) => !c.checked && !c.indeterminate);

        return {
          ...n,
          children,
          checked: allChecked,
          indeterminate: !allChecked && !noneChecked,
        };
      };
      return nodes.map(process);
    };

    setTreeData(prev => updateParents(applyUpdate(prev)));
  };

  // Helper function to check if a folder is a descendant of another folder
  const isFolderDescendant = (folderId: number, potentialAncestorId: number): boolean => {
    let currentFolder = allFolders.find((f) => f.id === folderId);
    while (currentFolder) {
      if (currentFolder.parentFolderId === potentialAncestorId) {
        return true;
      }
      currentFolder = allFolders.find((f) => f.id === currentFolder?.parentFolderId);
    }
    return false;
  };

  // Drag & Drop
  const handleMove = async ({ dragIds, parentNode }: { dragIds: string[]; parentNode: NodeApi<NodeData> | null }) => {
    if (!parentNode?.data.folderId) return;
    const targetId = parentNode.data.folderId;

    // Determine if dragging a folder or cases
    const draggedNodes = dragIds.map((id) => {
      if (id.startsWith('folder-')) {
        const folderId = Number(id.replace('folder-', ''));
        return { id, isFolder: true, folderId };
      } else if (id.startsWith('case-')) {
        const caseId = Number(id.replace('case-', ''));
        return { id, isFolder: false, node: nodesMapRef.current[caseId]?.data };
      }
      return null;
    }).filter(Boolean);

    // Check if any dragged item is a folder
    const draggedFolder = draggedNodes.find((n) => n && n.isFolder);

    if (draggedFolder) {
      // Handle folder move
      // Collect all checked folders
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
      const foldersToMove = checkedFolders.length > 0 ? checkedFolders : [draggedNodes.find(n => n && n.isFolder && n.folderId)].map(n => {
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
      }).filter((n): n is NodeData => n !== null);

      // Validate all folders
      for (const folder of foldersToMove) {
        if (!folder.folderId) continue;

        // Prevent dropping folder into itself
        if (folder.folderId === targetId) {
          console.warn('Cannot move folder into itself');
          return;
        }

        // Prevent dropping folder into its own descendants
        if (isFolderDescendant(targetId, folder.folderId)) {
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

      // Show dialog
      setCasesToMove([]);
      setFoldersToMove(foldersToMove);
      setTotalCasesInFolders(totalCases);
      setTargetFolderId(targetId);
      setIsMoveDialogOpen(true);
      return;
    }

    // Handle case move (existing logic)
    // Helper to collect checked cases and identify checked but unloaded folders
    const getCheckedCasesAndFolders = (nodes: NodeData[]): {
      cases: NodeData[],
      unloadedFolderIds: number[]
    } => {
      let cases: NodeData[] = [];
      let unloadedFolderIds: number[] = [];

      for (const n of nodes) {
        if (n.isCase && n.checked) {
          cases.push(n);
        } else if (!n.isCase && n.checked && !n.loaded && n.folderId) {
          // Folder is checked but not loaded - need to fetch its cases recursively
          unloadedFolderIds.push(n.folderId);
        }

        // Recursively process children
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

    // Convert recursive cases to NodeData format
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

    const dragCases = dragIds.map((id) => nodesMapRef.current[Number(id.replace('case-', ''))]?.data).filter(Boolean);
    const allSelectedCases = [...selectedCases, ...recursiveNodes];
    const finalCases = allSelectedCases.length ? allSelectedCases : dragCases;
    if (!finalCases.length) return;
    setCasesToMove(finalCases);
    setTargetFolderId(targetId);
    setIsMoveDialogOpen(true);
  };

  const handleMoved = async () => {
    if (!targetFolderId) return;

    // Handle folder moves
    if (foldersToMove.length > 0) {
      try {
        // Move all folders via API
        for (const folderNode of foldersToMove) {
          if (!folderNode.folderId) continue;

          const folder = allFolders.find((f) => f.id === folderNode.folderId);
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

        // Update allFolders state
        const folderIds = foldersToMove.map(f => f.folderId).filter((id): id is number => id !== undefined);
        setAllFolders((prev) =>
          prev.map((f) => (folderIds.includes(f.id) ? { ...f, parentFolderId: targetFolderId } : f))
        );

        // Remove folders from old location in tree
        const removeFolders = (nodes: NodeData[]): NodeData[] =>
          nodes
            .map((n) => ({ ...n, children: removeFolders(n.children) }))
            .filter((n) => n.folderId !== undefined && !folderIds.includes(n.folderId));

        // Find the target node in tree
        const findTargetNode = (nodes: NodeData[]): NodeData | null => {
          for (const n of nodes) {
            if (n.folderId === targetFolderId) return n;
            const found = findTargetNode(n.children);
            if (found) return found;
          }
          return null;
        };

        const targetNode = findTargetNode(treeData);

        // Add folders to new location in tree
        const addToTargetFolder = (nodes: NodeData[]): NodeData[] =>
          nodes.map((n) => {
            if (n.folderId === targetFolderId) {
              // Only update if target is loaded
              if (!n.loaded) {
                // Don't modify children for unloaded nodes
                return n;
              }

              const createNodeIndex = n.children.findIndex((c) => c.isCreateNode);
              const newFolders: NodeData[] = foldersToMove.map(folderNode => {
                const folder = allFolders.find(f => f.id === folderNode.folderId);
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

        // Only update tree if target is loaded
        if (targetNode?.loaded) {
          setTreeData((prev) => addToTargetFolder(removeFolders(prev)));
        } else {
          // Just remove from old location
          setTreeData((prev) => removeFolders(prev));
        }

        // Uncheck all folders
        const uncheckAll = (nodes: NodeData[]): NodeData[] =>
          nodes.map((n) => ({
            ...n,
            checked: false,
            indeterminate: false,
            children: uncheckAll(n.children),
          }));

        setTreeData((prev) => uncheckAll(prev));
      } catch (error) {
        console.error('Error moving folders:', error);
        addToast({
          title: 'Error',
          color: 'danger',
          description: error instanceof Error ? error.message : 'Failed to move folders'
        });
        return;
      }

      addToast({
        title: 'Success',
        color: 'success',
        description: 'Folders moved successfully'
      });

      setIsMoveDialogOpen(false);
      setFoldersToMove([]);
      setTotalCasesInFolders(0);
      return;
    }

    // Handle case moves (existing logic)
    const caseIds = casesToMove.map((c) => c.caseData?.id).filter((id): id is number => id !== undefined);
    const success = await moveCases(ctx.token.access_token, caseIds, targetFolderId, Number(projectId));
    if (!success) {
      addToast({
        title: 'Error',
        color: 'danger',
        description: 'Failed to move test cases'
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

    // Uncheck all cases
    const uncheckAll = (nodes: NodeData[]): NodeData[] =>
      nodes.map((n) => ({
        ...n,
        checked: false,
        indeterminate: false,
        children: uncheckAll(n.children),
      }));

    setTreeData((prev) => uncheckAll(prev));

    addToast({
      title: 'Success',
      color: 'success',
      description: messages.casesMoved
    });

    setIsMoveDialogOpen(false);
    setCasesToMove([]);
  };

  // Component for creating new items
  const CreateNodeRow = ({
    parentFolderId,
    style,
    level,
  }: {
    parentFolderId: number;
    style: React.CSSProperties;
    level: number;
  }) => {
    const [mode, setMode] = useState<CreateMode>('folder');
    const [value, setValue] = useState('');
    const [isHovered, setIsHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleModeSwitch = (newMode: CreateMode) => {
      setMode(newMode);
      setValue('');
      inputRef.current?.focus();
    };

    const handleCreate = async () => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return;

      if (mode === 'folder') {
        const newFolder = await createFolder(
          ctx.token.access_token,
          trimmedValue,
          '',
          projectId,
          parentFolderId
        );

        if (newFolder) {
          setAllFolders((prev) => [...prev, newFolder]);

          // Add folder locally to the tree
          const folderNode: NodeData = {
            id: `folder-${newFolder.id}`,
            name: newFolder.name,
            children: [],
            folderId: newFolder.id,
            parentFolderId: newFolder.parentFolderId,
            loaded: false,
            checked: false,
            indeterminate: false,
            open: false,
          };
          addNodeToParent(parentFolderId, folderNode);
        }
      } else {
        const newCase = await createCase(ctx.token.access_token, String(parentFolderId), trimmedValue, '');

        if (newCase) {
          // Add case locally to the tree
          const caseNode: NodeData = {
            id: `case-${newCase.id}`,
            name: newCase.title,
            isCase: true,
            caseData: newCase,
            folderId: parentFolderId,
            children: [],
            loaded: true,
          };
          addNodeToParent(parentFolderId, caseNode);

          if (onCaseClick) {
            onCaseClick(newCase);
          }
        }
      }

      setValue('');
      setMode('folder');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      e.stopPropagation();

      if (e.key === 'Enter') {
        handleCreate();
      } else if (e.key === 'Escape') {
        setValue('');
        setMode('folder');
        inputRef.current?.blur();
      }
    };

    const handleContainerClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      inputRef.current?.focus();
    };

    return (
      <div
        ref={containerRef}
        style={{
          ...style,
          display: 'flex',
          flex: '1 1 auto',
          paddingLeft: level * 12,
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          alignItems: 'center',
          gap: '4px',
        }}
        className="tree-row create-node-row"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleContainerClick}
      >
        <div className="icon-wrap">
          {mode === 'folder' ? (
            <Folder size={17} strokeWidth={1.4} />
          ) : (
            <Plus size={17} strokeWidth={1.4} />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            // Check if focus moved outside the container
            const relatedTarget = e.relatedTarget as Node | null;
            if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
              // Focus stayed within container, don't reset
              return;
            }

            if (!value.trim()) {
              setValue('');
              setMode('folder');
            }
          }}
          placeholder={mode === 'folder' ? 'Folder' : 'Test Case'}
          className="create-node-input"
          style={{
            flex: '0 0 auto',
            width: value ? 'auto' : (mode === 'folder' ? '6ch' : '9ch'),
            minWidth: mode === 'folder' ? '6ch' : '9ch',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 'inherit',
          }}
        />
        {isHovered && !value && (
          <>
            <span className="hint-text">or create</span>
            <button
              onMouseDown={(e) => {

                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleModeSwitch(mode === 'folder' ? 'case' : 'folder');
              }}
              className="mode-switch-button"
            >
              <Plus size={14} strokeWidth={2} />
              {mode === 'folder' ? 'Test Case' : 'Folder'}
            </button>
          </>
        )}
      </div>
    );
  };

  // Calculate total case count
  useEffect(() => {
    if (!ctx.isSignedIn()) return; // Wait for authentication
    if (!isFilterEmpty(filter)) return; // If filter is applied, don't count (count is done in loadFilteredTree)

    const loadTotalCaseCount = async () => {
      const count = await fetchCasesCount(ctx.token.access_token, Number(projectId));
      onFilterCount?.(count);
    };

    loadTotalCaseCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, ctx, projectId]);

  // Case icon
  const renderCaseIcon = (caseData: CaseType) =>
    caseData.automationStatus === 1 ? <Bot size={16} strokeWidth={1.5} /> : <Hand size={16} strokeWidth={1.5} />;

  // Open state for filtering
  const openStateMap = useRef(new Map<number, boolean>());
  const saveOpenState = (nodes: NodeData[]) => {
    nodes.forEach((n) => {
      if (n.folderId) openStateMap.current.set(n.folderId, n.open ?? false);
      if (n.children.length) saveOpenState(n.children);
    });
  };
  saveOpenState(treeData);

  // Ref to track initial load
  const isInitialLoad = useRef(true);
  const prevFilterRef = useRef(filter);

  // Filtering only on trigger
  useEffect(() => {
    // Check if filter has changed
    const filterChanged = JSON.stringify(prevFilterRef.current) !== JSON.stringify(filter);
    prevFilterRef.current = filter;

    console.log('[ArboristTree] Filter effect triggered', {
      filter,
      isInitialLoad: isInitialLoad.current,
      filterChanged
    });

    if (isFilterEmpty(filter)) {
      // If filter is empty and this is not the first load and filter hasn't changed,
      // DON'T reload tree (this may be triggered by allFolders change)
      if (!isInitialLoad.current && !filterChanged && treeData.length > 0) {
        console.log('[ArboristTree] Skipping full tree reload - no filter change');
        return;
      }

      // Save open state before resetting filter
      if (treeRef.current) {
        const currentOpenState: Record<string, boolean> = {};
        treeRef.current.visibleNodes.forEach((n: NodeApi<NodeData>) => {
          if (!n.data.isCase) {
            currentOpenState[n.data.id] = n.isOpen;
          }
        });
        setInitialOpenState(currentOpenState);
      }

      // Reset to original tree
      const loadFullTree = async () => {
        console.log('[ArboristTree] Loading full tree');

        // First, root folders
        const roots = allFolders
          .filter((f) => f.parentFolderId === null)
          .map((f) => ({
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

        // Recursively load cases for all folders
        const loadCasesRecursively = async (nodes: NodeData[]) => {
          for (const node of nodes) {
            if (node.folderId) {
              await loadFolder(node);
              if (node.children.length) await loadCasesRecursively(node.children);
            }
          }
        };

        await loadCasesRecursively(roots);
        console.log('[ArboristTree] Full tree loaded');
        isInitialLoad.current = false;
      };

      loadFullTree();
      return;
    }

    const loadFilteredTree = async () => {
      const cases: CaseType[] = await searchCases(
        ctx.token.access_token,
        Number(projectId),
        filter.search,
        filter.priorities,
        filter.types,
        filter.tags
      );
      onFilterCount?.(cases.length);

      const folderMap: Record<number, NodeData> = {};
      cases.forEach((c) => {
        let f = allFolders.find((f) => f.id === c.folderId);
        if (!f) return;
        const path: FolderType[] = [];
        while (f) {
          path.unshift(f);
          f = f.parentFolderId !== null ? allFolders.find((x) => x.id === f?.parentFolderId) : undefined;
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
              open: openStateMap.current.get(folder.id) ?? false,
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

      // Add create nodes for each folder
      Object.values(folderMap).forEach((node) => {
        node.children.push({
          id: `create-${node.folderId}`,
          name: 'New Folder',
          isCreateNode: true,
          createParentId: node.folderId,
          children: [],
          loaded: true,
        });
      });

      setTreeData(roots);
    };

    loadFilteredTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, allFolders, ctx, projectId]);
  // IMPORTANT: onFilterCount should NOT be in dependencies,
  // as it's a function from props that may change on each render

  return (
    <>
      <div
        ref={treeContainerRef}
        style={{
          height: '100%',
          width: '100%',
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
      >
        {treeHeight > 0 && (
          <Tree
            ref={treeRef}
            data={treeData}
            height={treeHeight}
            width={treeWidth}
            childrenAccessor="children"
            openByDefault={false}
            initialOpenState={initialOpenState}
            onMove={handleMove}
            disableDrag={(node) => node.isCreateNode === true}
            disableDrop={({ parentNode }) => !parentNode?.data.folderId}
            disableEdit={true}
          >
            {({ node, style, dragHandle }) => {
              if (node.data.isCase && node.data.caseData) {
                nodesMapRef.current[node.data.caseData.id] = node;
              }

              // Render create node (only for developers)
              if (node.data.isCreateNode && node.data.createParentId) {
                if (!ctx.isProjectDeveloper(Number(projectId))) {
                  return null;
                }
                return <CreateNodeRow parentFolderId={node.data.createParentId} style={style} level={node.level} />;
              }

              // Render regular nodes
              return (
                <div
                  style={{
                    ...style,
                    display: 'flex',
                    flex: '1 1 auto',
                    paddingLeft: node.level * 12,
                    width: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                  className={`tree-row ${node.data.isCase && node.data.caseData?.id === selectedCaseId ? 'selected-case' : ''}`}
                  onClick={() => handleClick(node)}
                  onContextMenu={(e) => handleContextMenu(e, node)}
                  ref={dragHandle}
                >
                  <input
                    type="checkbox"
                    checked={node.data.checked || false}
                    ref={(el) => {
                      if (el) el.indeterminate = node.data.indeterminate || false;
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCheck(node);
                    }}
                    className="checkbox-input"
                  />
                  <div className="icon-wrap">
                    {node.data.isCase && node.data.caseData ? (
                      renderCaseIcon(node.data.caseData)
                    ) : (
                      <>
                        <Folder className="folder-icon" size={17} strokeWidth={1.4} />
                        {!node.isOpen ? (
                          <ChevronRight className="hover-icon" size={17} strokeWidth={1.6} />
                        ) : (
                          <ChevronDown className="hover-icon" size={17} strokeWidth={1.6} />
                        )}
                      </>
                    )}
                  </div>
                  {isRenaming === node.data.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={handleRenameSubmit}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="title"
                      style={{
                        border: '1px solid #3b82f6',
                        outline: 'none',
                        padding: '0 4px',
                        borderRadius: '2px',
                      }}
                    />
                  ) : (
                    <span className="title">{node.data.name}</span>
                  )}
                </div>
              );
            }}
          </Tree>
        )}
      </div>

      {isMoveDialogOpen && (
        <CaseDialog
          isOpen={isMoveDialogOpen}
          testCaseIds={casesToMove.map((c) => c.caseData?.id).filter((id): id is number => id !== undefined)}
          foldersCount={foldersToMove.length}
          totalCasesInFolders={totalCasesInFolders}
          projectId={projectId}
          targetFolderId={targetFolderId}
          isDisabled={!ctx.isProjectDeveloper(Number(projectId))}
          onCancel={() => {
            setIsMoveDialogOpen(false);
            setCasesToMove([]);
            setFoldersToMove([]);
            setTotalCasesInFolders(0);
          }}
          onMoved={handleMoved}
          messages={messages}
          token={ctx.token.access_token}
        />
      )}

      {contextMenu.visible && contextMenu.node && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="context-menu-item" onClick={handleContextSelect}>
            Select
          </button>
          <button className="context-menu-item" onClick={handleContextRename}>
            Rename
          </button>
          <button className="context-menu-item" onClick={handleContextMove}>
            Move
          </button>
          <button className="context-menu-item context-menu-item-danger" onClick={handleContextDelete}>
            Delete
          </button>
        </div>
      )}
    </>
  );
}
