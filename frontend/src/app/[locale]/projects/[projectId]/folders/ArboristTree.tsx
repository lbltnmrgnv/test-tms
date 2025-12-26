/**
 * ArboristTree - Tree component for folders and test cases with drag-and-drop support
 */
'use client';
import { useState, useEffect, useContext, useRef } from 'react';
import { Tree, NodeApi } from 'react-arborist';
import { Folder, ChevronRight, ChevronDown, Bot, Hand, Plus } from 'lucide-react';
import { CaseType, CasesMessages } from '@/types/case';
import { FilterOptions } from '@/types/filter';
import { FolderType } from '@/types/folder';
import CaseDialog from '@/src/app/[locale]/projects/[projectId]/folders/[folderId]/cases/CaseMoveDialog';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchCases, moveCases, searchCases, createCase, fetchCasesCount } from '@/utils/caseControl';
import { fetchFolders, createFolder } from './foldersControl';

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
  const [targetFolderId, setTargetFolderId] = useState<number | undefined>(undefined);

  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const [treeHeight, setTreeHeight] = useState<number>(0);
  const [treeWidth, setTreeWidth] = useState(0);

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

    const children: NodeData[] = [
      ...subFolders.map((f) => ({
        id: `folder-${f.id}`,
        name: f.name,
        children: [],
        folderId: f.id,
        parentFolderId: f.parentFolderId,
        loaded: false,
        checked: false,
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
  const toggleCheck = (node: NodeApi<NodeData>) => {
    const newState = !node.data.checked;

    // Recursively update state of all child nodes
    const updateChildren = (nodes: NodeData[], state: boolean): NodeData[] =>
      nodes.map((n) => ({
        ...n,
        checked: state,
        indeterminate: false,
        children: updateChildren(n.children, state),
      }));

    // Apply update to target node and its children
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

    setTreeData(updateParents(applyUpdate(treeData)));
  };

  // Drag & Drop
  const handleMove = async ({ dragIds, parentNode }: { dragIds: string[]; parentNode: NodeApi<NodeData> | null }) => {
    if (!parentNode?.data.folderId) return;
    const targetId = parentNode.data.folderId;
    const getCheckedCases = (nodes: NodeData[]): NodeData[] => {
      let result: NodeData[] = [];
      for (const n of nodes) {
        if (n.isCase && n.checked) result.push(n);
        result = result.concat(getCheckedCases(n.children));
      }
      return result;
    };
    const selectedCases = getCheckedCases(treeData);
    const dragCases = dragIds.map((id) => nodesMapRef.current[Number(id.replace('case-', ''))]?.data).filter(Boolean);
    const finalCases = selectedCases.length ? selectedCases : dragCases;
    if (!finalCases.length) return;
    setCasesToMove(finalCases);
    setTargetFolderId(targetId);
    setIsMoveDialogOpen(true);
  };

  const handleMoved = async () => {
    if (!targetFolderId) return;
    const caseIds = casesToMove.map((c) => c.caseData?.id).filter((id): id is number => id !== undefined);
    const success = await moveCases(ctx.token.access_token, caseIds, targetFolderId, Number(projectId));
    if (!success) return;

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
    setIsMoveDialogOpen(false);
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
            disableDrag={(node) => !node.isCase || node.isCreateNode === true}
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
                  <span className="title">{node.data.name}</span>
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
          projectId={projectId}
          targetFolderId={targetFolderId}
          isDisabled={!ctx.isProjectDeveloper(Number(projectId))}
          onCancel={() => setIsMoveDialogOpen(false)}
          onMoved={handleMoved}
          messages={messages}
          token={ctx.token.access_token}
        />
      )}
    </>
  );
}
