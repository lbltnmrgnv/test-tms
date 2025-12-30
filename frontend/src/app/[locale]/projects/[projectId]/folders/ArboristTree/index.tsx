/**
 * ArboristTree - Tree component for folders and test cases with drag-and-drop support
 * Refactored version with modular architecture
 */
'use client';
import { useState, useEffect, useContext, useRef } from 'react';
import { Tree, NodeApi } from 'react-arborist';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchCasesRecursive } from '@/utils/caseControl';
import CaseDialog from '@/src/app/[locale]/projects/[projectId]/folders/[folderId]/cases/CaseMoveDialog';
import CaseDeleteDialog from '@/src/app/[locale]/projects/[projectId]/folders/CaseDeleteDialog';

// Types
import { ArboristTreeProps, NodeData } from './types';

// Hooks
import { useTreeData } from './hooks/useTreeData';
import { useCheckboxSelection } from './hooks/useCheckboxSelection';
import { useContextMenu } from './hooks/useContextMenu';
import { useMoveDialog } from './hooks/useMoveDialog';
import { useDeleteDialog } from './hooks/useDeleteDialog';
import { useDragDrop } from './hooks/useDragDrop';

// Components
import { CreateNodeRow } from './components/CreateNodeRow';
import { TreeNode } from './components/TreeNode';
import { ContextMenu } from './components/ContextMenu';

export default function ArboristTree({
  projectId,
  messages,
  selectedCaseId,
  onCaseClick,
  onCaseUpdated,
  filter = {},
  onFilterCount,
  updatedCase,
  onSelectionChange,
  triggerBulkDelete,
  onBulkDeleteComplete,
}: ArboristTreeProps) {
  const ctx = useContext(TokenContext);
  const treeRef = useRef<any>(null);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const [treeHeight, setTreeHeight] = useState<number>(0);
  const [treeWidth, setTreeWidth] = useState(0);

  // Rename state
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Tree data management
  const {
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
  } = useTreeData({
    projectId,
    filter,
    onFilterCount,
    updatedCase,
    onCaseUpdated,
  });

  // Checkbox selection
  const { toggleCheck } = useCheckboxSelection({
    treeData,
    setTreeData,
    onSelectionChange,
    loadFolderRecursively,
  });

  // Move dialog
  const {
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
  } = useMoveDialog({
    projectId,
    allFolders,
    setAllFolders,
    treeData,
    setTreeData,
    messages,
  });

  // Delete dialog
  const {
    isDeleteDialogOpen,
    casesToDelete,
    foldersToDelete,
    totalCasesInDeleteFolders,
    openDeleteDialog,
    closeDeleteDialog,
    handleDeleteConfirmed,
  } = useDeleteDialog({
    projectId,
    treeData,
    setTreeData,
    setAllFolders,
    triggerBulkDelete,
    onBulkDeleteComplete,
  });

  // Drag and drop
  const { handleMove, nodesMapRef } = useDragDrop({
    treeData,
    allFolders,
    onMoveDialogOpen: openMoveDialog,
  });

  // Context menu handlers
  const handleContextMoveRequest = async (node: NodeApi<NodeData>) => {
    if (node.data.isCase) {
      setCasesToMove([node.data]);
      setFoldersToMove([]);
      setTotalCasesInFolders(0);
      setTargetFolderId(undefined);
      openMoveDialog([node.data], [], 0, undefined);
    } else if (node.data.folderId) {
      const folderId = node.data.folderId;
      const recursiveCases = await fetchCasesRecursive(ctx.token.access_token, folderId);
      openMoveDialog([], [node.data], recursiveCases.length, undefined);
    }
  };

  const handleContextDeleteRequest = async (node: NodeApi<NodeData>) => {
    if (node.data.isCase && node.data.caseData) {
      openDeleteDialog([node.data], [], 0);
    } else if (node.data.folderId) {
      const folderId = node.data.folderId;
      const recursiveCases = await fetchCasesRecursive(ctx.token.access_token, folderId);
      openDeleteDialog([], [node.data], recursiveCases.length);
    }
  };

  // Context menu
  const {
    contextMenu,
    handleContextMenu,
    handleContextSelect,
    handleContextRename,
    handleContextMove,
    handleContextDelete,
  } = useContextMenu({
    onSelect: toggleCheck,
    onRenameStart: (nodeId, currentName) => {
      setIsRenaming(nodeId);
      setRenameValue(currentName);
    },
    onMove: handleContextMoveRequest,
    onDelete: handleContextDeleteRequest,
  });

  // Tree dimensions
  useEffect(() => {
    if (!treeContainerRef.current) return;
    const container = treeContainerRef.current;
    const update = () => {
      setTreeHeight(container.offsetHeight);
      setTreeWidth(container.offsetWidth);
    };
    requestAnimationFrame(update);

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);

    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      resizeObserver.disconnect();
    };
  }, []);

  // Node click handler
  const handleClick = async (node: NodeApi<NodeData>) => {
    if (node.data.isCase && node.data.caseData) {
      onCaseClick?.(node.data.caseData);
      return;
    }

    node.toggle();

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

  // Handle rename submit
  const handleRenameSubmit = async () => {
    if (!isRenaming || !renameValue.trim()) {
      setIsRenaming(null);
      return;
    }

    const success = await handleRename(isRenaming, renameValue);
    if (success) {
      setIsRenaming(null);
      setRenameValue('');
    }
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

  // Handle folder/case creation
  const handleFolderCreated = (parentFolderId: number | null, newFolder: NodeData, folderData?: any) => {
    // If folderData from API is provided, use it; otherwise create default values
    if (folderData) {
      setAllFolders((prev) => [
        ...prev,
        {
          id: folderData.id,
          name: folderData.name,
          parentFolderId: folderData.parentFolderId ?? null,
          projectId: Number(projectId),
          detail: folderData.detail || '',
          createdAt: folderData.createdAt,
          updatedAt: folderData.updatedAt,
          Cases: folderData.Cases || [],
        },
      ]);
    } else {
      // Fallback to basic values if API data not available
      setAllFolders((prev) => [
        ...prev,
        {
          id: newFolder.folderId!,
          name: newFolder.name,
          parentFolderId: newFolder.parentFolderId ?? null,
          projectId: Number(projectId),
          detail: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          Cases: [],
        },
      ]);
    }

    if (parentFolderId === null) {
      setTreeData((prev) => [...prev, newFolder]);
    } else {
      addNodeToParent(parentFolderId, newFolder);
    }
  };

  const handleCaseCreated = (parentFolderId: number, newCase: NodeData, caseData: any) => {
    addNodeToParent(parentFolderId, newCase);
    if (onCaseClick) {
      onCaseClick(caseData);
    }
  };

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
        {treeData.length === 0 && ctx.isProjectDeveloper(Number(projectId)) && (
          <div style={{ padding: '8px 0' }}>
            <CreateNodeRow
              parentFolderId={null}
              projectId={projectId}
              style={{ height: '32px' }}
              level={0}
              isRootLevel={true}
              onFolderCreated={handleFolderCreated}
              onCaseCreated={handleCaseCreated}
            />
          </div>
        )}
        {treeHeight > 0 && treeData.length > 0 && (
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
                return (
                  <CreateNodeRow
                    parentFolderId={node.data.createParentId}
                    projectId={projectId}
                    style={style}
                    level={node.level}
                    onFolderCreated={handleFolderCreated}
                    onCaseCreated={handleCaseCreated}
                  />
                );
              }

              // Render regular nodes
              return (
                <TreeNode
                  node={node}
                  style={style}
                  dragHandle={dragHandle}
                  selectedCaseId={selectedCaseId}
                  isRenaming={isRenaming === node.data.id}
                  renameValue={renameValue}
                  onRenameValueChange={setRenameValue}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameKeyDown={handleRenameKeyDown}
                  onClick={handleClick}
                  onContextMenu={handleContextMenu}
                  onCheckboxToggle={toggleCheck}
                />
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
          onCancel={closeMoveDialog}
          onMoved={handleMoved}
          messages={messages}
          token={ctx.token.access_token}
        />
      )}

      {isDeleteDialogOpen && (
        <CaseDeleteDialog
          isOpen={isDeleteDialogOpen}
          testCaseIds={casesToDelete.map((c) => c.caseData?.id).filter((id): id is number => id !== undefined)}
          foldersCount={foldersToDelete.length}
          totalCasesInFolders={totalCasesInDeleteFolders}
          isDisabled={!ctx.isProjectDeveloper(Number(projectId))}
          onCancel={closeDeleteDialog}
          onDelete={handleDeleteConfirmed}
          messages={messages}
        />
      )}

      <ContextMenu
        contextMenu={contextMenu}
        onSelect={handleContextSelect}
        onRename={handleContextRename}
        onMove={handleContextMove}
        onDelete={handleContextDelete}
      />
    </>
  );
}
