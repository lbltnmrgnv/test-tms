'use client';
import { useState, useRef, useEffect, useContext } from 'react';
import { addToast } from '@heroui/react';
import { TokenContext } from '@/utils/TokenProvider';
import { createCase } from '@/utils/caseControl';
import { CasesMessages, CaseType } from '@/types/case';
import CaseDialog from './CaseDialog';
import CaseImportDialog from './CaseImportDialog';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import ArboristTree from '@/src/app/[locale]/projects/[projectId]/folders/ArboristTree';
import CaseEditor from '@/src/app/[locale]/projects/[projectId]/folders/[folderId]/cases/[caseId]/CaseEditor';
import { PriorityMessages } from '@/types/priority';
import { TestTypeMessages } from '@/types/testType';
import { LocaleCodeType } from '@/types/locale';

type Props = {
  projectId: string;
  folderId: string;
  messages: CasesMessages;
  priorityMessages?: PriorityMessages;
  testTypeMessages?: TestTypeMessages;
  locale: LocaleCodeType;
};

export default function CasesPane({ projectId, messages }: Props) {
  const context = useContext(TokenContext);

  // состояние модалок / прочее
  const [isCaseDialogOpen, setIsCaseDialogOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<number | undefined>(undefined);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [deleteCaseIds, setDeleteCaseIds] = useState<number[]>([]);

  // выбранный кейс (справа)
  const [selectedCase, setSelectedCase] = useState<CaseType | null>(null);

  // -------------------- Resizable Split --------------------
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState(false);

  // === УСТАНАВЛИВАЕМ ЦЕНТР ПРИ ПЕРВОЙ ЗАГРУЗКЕ ===
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      setLeftWidth(containerWidth / 2);
    }
  }, []);

  // Начало ресайза
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Движение ресайза
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

  // -------------------- Создание кейса --------------------
  const handleCreateCase = async (title: string, description: string, folderId?: number, createMore?: boolean) => {
    const newCase = await createCase(context.token.access_token, String(folderId), title, description);
    addToast({ title: 'Success', color: 'success', description: `Case "${title}" created` });

    if (!createMore) setIsCaseDialogOpen(false);
  };

  const closeDeleteConfirmDialog = () => {
    setIsDeleteConfirmDialogOpen(false);
    setDeleteCaseIds([]);
  };

  // -------------------- Рендер --------------------
  return (
    <>
      <div ref={containerRef} style={{ display: 'flex', width: '100%', height: '100%', minHeight: 400 }}>
        {/* ЛЕВАЯ ПАНЕЛЬ */}
        <div style={{ width: leftWidth, overflow: 'auto', borderRight: '1px solid var(--border-color)', padding: '12px 8px' }}>
          <ArboristTree
            projectId={projectId}
            messages={messages}
            onCaseClick={(caseData: CaseType) => {
              setSelectedCase(caseData);
            }}
          />
        </div>

        {/* РЕЗАЙЗ БАР */}
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
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {selectedCase ? (
            <CaseEditor
              projectId={projectId}
              folderId={String(selectedCase.folderId ?? '')}
              caseId={String(selectedCase.id)}
              messages={messages as any}
              testTypeMessages={{} as any}
              priorityMessages={{} as any}
              locale={'en'}
            />
          ) : (
            <div style={{ color: 'var(--muted-color)' }}>
              <h3 style={{ marginTop: 20 }}>Выберите тест-кейс</h3>
              <p>Нажмите на кейс слева, чтобы открыть его и редактировать.</p>
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
    </>
  );
}