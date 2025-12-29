'use client';
import { useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spinner } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import { CasesMessages } from '@/types/case';

type Props = {
  isOpen: boolean;
  testCaseIds: number[];
  foldersCount?: number;
  totalCasesInFolders?: number;
  isDisabled: boolean;
  onCancel: () => void;
  onDelete: () => Promise<void>;
  messages: CasesMessages;
};

export default function CaseDeleteDialog({
  isOpen,
  testCaseIds,
  foldersCount = 0,
  totalCasesInFolders = 0,
  isDisabled,
  onCancel,
  onDelete,
  messages,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDelete = async () => {
    setIsProcessing(true);
    await onDelete();
    setIsProcessing(false);
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={() => {
        if (!isProcessing) {
          onCancel();
        }
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">{messages.areYouSure}</ModalHeader>
        <ModalBody>
          {foldersCount > 0 ? (
            <div className="flex flex-col gap-2">
              <p>
                {foldersCount} {foldersCount === 1 ? 'folder' : 'folders'} will be deleted
              </p>
              <p className="text-sm text-gray-600">
                Total test cases in folders: {totalCasesInFolders}
              </p>
              <p className="text-sm text-red-600 font-semibold">
                This action cannot be undone.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p>
                {testCaseIds.length} {testCaseIds.length === 1 ? 'test case' : 'test cases'} will be deleted
              </p>
              <p className="text-sm text-red-600 font-semibold">
                This action cannot be undone.
              </p>
            </div>
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
              <Button
                color="danger"
                size="sm"
                onPress={handleDelete}
                startContent={<Trash2 size={16} />}
                isDisabled={isDisabled}
              >
                {messages.delete}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
