'use client';
import { useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spinner, addToast } from '@heroui/react';
import { Copy, Forward } from 'lucide-react';
import { CasesMessages } from '@/types/case';
import { cloneCases } from '@/utils/caseControl';

type Props = {
  isOpen: boolean;
  testCaseIds: number[];
  foldersCount?: number;
  totalCasesInFolders?: number;
  projectId: string;
  targetFolderId?: number;
  isDisabled: boolean;
  onCancel: () => void;
  onMoved: () => void;
  messages: CasesMessages;
  token: string;
};

export default function CaseDialog({
  isOpen,
  testCaseIds,
  foldersCount = 0,
  totalCasesInFolders = 0,
  projectId,
  targetFolderId,
  isDisabled,
  onCancel,
  onMoved,
  messages,
  token,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMove = async () => {
    if (!targetFolderId) {
      return;
    }

    setIsProcessing(true);
    await onMoved();
    setIsProcessing(false);
    onCancel();
  };

  const handleClone = async () => {
    if (!targetFolderId) {
      return;
    }

    setIsProcessing(true);
    const success = await cloneCases(token, testCaseIds, targetFolderId, Number(projectId));
    setIsProcessing(false);

    if (success) {
      addToast({ title: 'Success', color: 'success', description: messages.casesCloned });
      onCancel();
    } else {
      console.error('Error cloning cases');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={() => {
        onCancel();
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">{messages.selectAction}</ModalHeader>
        <ModalBody>
          {foldersCount > 0 ? (
            <div className="flex flex-col gap-2">
              <p>
                {foldersCount} {foldersCount === 1 ? 'folder' : 'folders'} selected
              </p>
              <p className="text-sm text-gray-600">
                Total test cases in folders: {totalCasesInFolders}
              </p>
            </div>
          ) : (
            <p>
              {testCaseIds.length} {messages.casesSelected}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          {isProcessing ? (
            <Spinner />
          ) : (
            <>
              <Button variant="light" size="sm" onPress={onCancel}>
                {messages.close}
              </Button>
              {foldersCount === 0 && (
                <Button
                  color="primary"
                  size="sm"
                  onPress={handleClone}
                  startContent={<Copy size={16} />}
                  isDisabled={isDisabled}
                >
                  {messages.clone}
                </Button>
              )}
              <Button
                color="primary"
                size="sm"
                onPress={handleMove}
                startContent={<Forward size={16} />}
                isDisabled={isDisabled}
              >
                {messages.move}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
