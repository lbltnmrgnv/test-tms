'use client';
import { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { addToast, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { MoreVertical, Trash2 } from 'lucide-react';
import { CasesMessages, CaseType, CaseMessages } from '@/types/case';
import { FilterOptions } from '@/types/filter';
import { LocaleCodeType } from '@/types/locale';
import { PriorityMessages } from '@/types/priority';
import { TestTypeMessages } from '@/types/testType';
import { CaseStatusMessages } from '@/types/status';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import DeletedCasesDialog from '@/components/DeletedCasesDialog';
import ArboristTree from '@/src/app/[locale]/projects/[projectId]/folders/ArboristTree';
import AdvancedFilterInput from '@/src/app/[locale]/projects/[projectId]/folders/components/AdvancedFilterInput';
import { createCase } from '@/utils/caseControl';
import { TokenContext } from '@/utils/TokenProvider';
import CaseDialog from './CaseDialog';
import CaseEditor from './[caseId]/CaseEditor';
import CaseImportDialog from './CaseImportDialog';

type Props = {
  projectId: string;
  folderId: string;
  messages: CasesMessages;
  caseMessages?: CaseMessages;
  priorityMessages?: PriorityMessages;
  testTypeMessages?: TestTypeMessages;
  caseStatusMessages?: CaseStatusMessages;
  locale: LocaleCodeType;
};

export default function CasesPane({ projectId, messages, caseMessages, priorityMessages, testTypeMessages, caseStatusMessages }: Props) {
  const context = useContext(TokenContext);

  const [isCaseDialogOpen, setIsCaseDialogOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<number | undefined>(undefined);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [isDeletedCasesDialogOpen, setIsDeletedCasesDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseType | null>(null);
  const [selectedItemsCount, setSelectedItemsCount] = useState(0);
  const [isBulkDeleteConfirmDialogOpen, setIsBulkDeleteConfirmDialogOpen] = useState(false);
  const [triggerBulkDelete, setTriggerBulkDelete] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);

  const [currentFilter, setCurrentFilter] = useState<FilterOptions>({});

  // --- Resizable Split ---
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      setLeftWidth(containerWidth / 2);
    }
  }, []);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let newWidth = e.clientX - rect.left;
      const minLeft = 200;
      const minRight = 200;
      if (newWidth < minLeft) newWidth = minLeft;
      if (newWidth > rect.width - minRight) newWidth = rect.width - minRight;
      setLeftWidth(newWidth);
    };

    const onMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  const handleCreateCase = async (title: string, description: string, folderId?: number, createMore?: boolean) => {
    await createCase(context.token.access_token, String(folderId), title, description);
    addToast({ title: 'Success', color: 'success', description: `Case "${title}" created` });
    if (!createMore) setIsCaseDialogOpen(false);
  };

  const closeDeleteConfirmDialog = () => {
    setIsDeleteConfirmDialogOpen(false);
  };

  const [updatedCase, setUpdatedCase] = useState<CaseType | undefined>(undefined);
  const [refreshTreeTrigger, setRefreshTreeTrigger] = useState(0);

  const handleCaseUpdated = (updatedCase: CaseType) => {
    if (selectedCase?.id === updatedCase.id) {
      setSelectedCase(updatedCase);
    }
    // Trigger tree update
    setUpdatedCase(updatedCase);
    // Reset after a small delay so useEffect in ArboristTree triggers
    setTimeout(() => setUpdatedCase(undefined), 0);
  };

  const handleRestoreSuccess = () => {
    // Refresh the tree to show restored cases
    setRefreshTreeTrigger((prev) => prev + 1);
  };

  const handleBulkDeleteConfirm = () => {
    setIsBulkDeleteConfirmDialogOpen(false);
    setTriggerBulkDelete(true);
  };

  const handleBulkDeleteComplete = () => {
    setTriggerBulkDelete(false);
    setRefreshTreeTrigger((prev) => prev + 1);
  };

  const handleFilterCount = useCallback((count: number) => {
    setFilteredCount(count);
  }, []);

  return (
    <>
      <div ref={containerRef} style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' }}>
        {/* ЛЕВАЯ ПАНЕЛЬ */}
        <div
          style={{
            width: leftWidth,
            overflow: 'auto',
            borderRight: '1px solid var(--border-color)',
            padding: '12px 8px',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Фильтр по кейсам */}
          <div style={{ marginBottom: 8 }}>
            <AdvancedFilterInput
              projectId={projectId}
              value={currentFilter}
              onChange={setCurrentFilter}
              priorityMessages={priorityMessages}
              testTypeMessages={testTypeMessages}
              caseStatusMessages={caseStatusMessages}
              placeholder="Search or add filter..."
            />
          </div>

          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--muted-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Test cases: {filteredCount}</span>
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly size="sm" className="bg-transparent rounded-full min-w-0 w-6 h-6">
                  <MoreVertical size={16} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Case actions">
                <DropdownItem
                  key="delete-selected"
                  startContent={<Trash2 size={16} />}
                  onPress={() => setIsBulkDeleteConfirmDialogOpen(true)}
                  isDisabled={selectedItemsCount === 0}
                >
                  Delete selected ({selectedItemsCount})
                </DropdownItem>
                <DropdownItem
                  key="deleted-cases"
                  startContent={<Trash2 size={16} />}
                  onPress={() => setIsDeletedCasesDialogOpen(true)}
                >
                  Deleted cases
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          <ArboristTree
            key={refreshTreeTrigger}
            projectId={projectId}
            messages={messages}
            filter={currentFilter}
            onFilterCount={handleFilterCount}
            selectedCaseId={selectedCase?.id}
            onCaseClick={(caseData: CaseType) => setSelectedCase(caseData)}
            onCaseUpdated={handleCaseUpdated}
            updatedCase={updatedCase}
            onSelectionChange={setSelectedItemsCount}
            triggerBulkDelete={triggerBulkDelete}
            onBulkDeleteComplete={handleBulkDeleteComplete}
          />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          style={{
            width: 6,
            cursor: 'col-resize',
            background: 'rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'stretch',
            zIndex: 20,
          }}
          onMouseDown={startResizing}
        />

        {/* ПРАВАЯ ПАНЕЛЬ */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {selectedCase ? (
            <CaseEditor
              projectId={projectId}
              folderId={String(selectedCase.folderId ?? '')}
              caseId={String(selectedCase.id)}
              messages={caseMessages || (messages as any)}
              testTypeMessages={testTypeMessages ?? ({} as any)}
              priorityMessages={priorityMessages ?? ({} as any)}
              caseStatusMessages={caseStatusMessages ?? ({} as any)}
              locale={'en'}
              onUpdated={handleCaseUpdated}
            />
          ) : (
            <div style={{ color: 'var(--muted-color)' }}>
              <h3 style={{ marginTop: 20 }}>{messages.selectCaseTitle}</h3>
              <p>{messages.selectCaseDescription}</p>
            </div>
          )}
        </div>
      </div>

      {/* Диалоги */}
      {isCaseDialogOpen && (
        <CaseDialog
          isOpen={isCaseDialogOpen}
          parentFolderId={currentFolderId}
          onCancel={() => setIsCaseDialogOpen(false)}
          onSubmit={handleCreateCase}
          messages={messages as any}
        />
      )}

      <CaseImportDialog
        isOpen={isImportDialogOpen}
        folderId={currentFolderId ?? 0}
        isDisabled={!context.isProjectDeveloper(Number(projectId))}
        onImport={() => setIsImportDialogOpen(false)}
        onCancel={() => setIsImportDialogOpen(false)}
        messages={messages}
        token={context.token.access_token}
      />

      <DeleteConfirmDialog
        isOpen={isDeleteConfirmDialogOpen}
        onCancel={closeDeleteConfirmDialog}
        onConfirm={closeDeleteConfirmDialog}
        closeText={messages.close}
        confirmText={messages.areYouSure}
        deleteText={messages.delete}
      />

      <DeletedCasesDialog
        isOpen={isDeletedCasesDialogOpen}
        onClose={() => setIsDeletedCasesDialogOpen(false)}
        projectId={projectId}
        onRestoreSuccess={handleRestoreSuccess}
      />

      <DeleteConfirmDialog
        isOpen={isBulkDeleteConfirmDialogOpen}
        onCancel={() => setIsBulkDeleteConfirmDialogOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        closeText={messages.close}
        confirmText={`Are you sure you want to delete ${selectedItemsCount} selected ${selectedItemsCount === 1 ? 'item' : 'items'}?`}
        deleteText={messages.delete}
      />
    </>
  );
}