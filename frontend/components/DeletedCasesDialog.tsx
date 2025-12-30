'use client';
import { useState, useEffect, useContext } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Checkbox, addToast } from '@heroui/react';
import { Trash2, RefreshCw } from 'lucide-react';
import { CaseType } from '@/types/case';
import { TokenContext } from '@/utils/TokenProvider';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onRestoreSuccess?: () => void;
};

export default function DeletedCasesDialog({ isOpen, onClose, projectId, onRestoreSuccess }: Props) {
  const { token } = useContext(TokenContext);
  const [deletedCases, setDeletedCases] = useState<CaseType[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDeletedCases();
    } else {
      // Reset state when dialog closes
      setDeletedCases([]);
      setSelectedCaseIds(new Set());
    }
  }, [isOpen, projectId]);

  const fetchDeletedCases = async () => {
    if (!token?.access_token) {
      console.error('No authentication token available');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cases/search?projectId=${projectId}&isDeleted=true`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deleted cases');
      }

      const data = await response.json();
      setDeletedCases(data);
    } catch (error) {
      console.error('Error fetching deleted cases:', error);
      addToast({
        title: 'Error',
        color: 'danger',
        description: 'Failed to load deleted cases',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCase = (caseId: number) => {
    const newSelected = new Set(selectedCaseIds);
    if (newSelected.has(caseId)) {
      newSelected.delete(caseId);
    } else {
      newSelected.add(caseId);
    }
    setSelectedCaseIds(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedCaseIds.size === deletedCases.length) {
      setSelectedCaseIds(new Set());
    } else {
      setSelectedCaseIds(new Set(deletedCases.map((c) => c.id)));
    }
  };

  const handleRestore = async () => {
    if (!token?.access_token) {
      console.error('No authentication token available');
      addToast({
        title: 'Error',
        color: 'danger',
        description: 'Authentication required to restore cases',
      });
      return;
    }

    if (selectedCaseIds.size === 0) {
      addToast({
        title: 'Warning',
        color: 'warning',
        description: 'Please select at least one case to restore',
      });
      return;
    }

    setIsRestoring(true);
    try {
      const response = await fetch(`/api/cases/bulkrestore?projectId=${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          caseIds: Array.from(selectedCaseIds),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to restore cases');
      }

      addToast({
        title: 'Success',
        color: 'success',
        description: `${selectedCaseIds.size} case(s) restored successfully`,
      });

      // Refresh the list
      await fetchDeletedCases();
      setSelectedCaseIds(new Set());

      if (onRestoreSuccess) {
        onRestoreSuccess();
      }
    } catch (error) {
      console.error('Error restoring cases:', error);
      addToast({
        title: 'Error',
        color: 'danger',
        description: 'Failed to restore cases',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Trash2 size={20} />
            <span>Deleted Test Cases</span>
          </div>
        </ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw size={24} className="animate-spin" />
            </div>
          ) : deletedCases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No deleted cases found</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  isSelected={selectedCaseIds.size === deletedCases.length && deletedCases.length > 0}
                  onValueChange={handleToggleAll}
                  isIndeterminate={selectedCaseIds.size > 0 && selectedCaseIds.size < deletedCases.length}
                />
                <span className="font-semibold text-sm">
                  Select All ({selectedCaseIds.size} of {deletedCases.length} selected)
                </span>
              </div>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {deletedCases.map((testCase) => (
                  <div
                    key={testCase.id}
                    className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => handleToggleCase(testCase.id)}
                  >
                    <Checkbox
                      isSelected={selectedCaseIds.has(testCase.id)}
                      onValueChange={() => handleToggleCase(testCase.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{testCase.title}</div>
                      {testCase.description && (
                        <div className="text-xs text-gray-500 truncate">{testCase.description}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">ID: {testCase.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} disabled={isRestoring}>
            Close
          </Button>
          <Button
            color="primary"
            onPress={handleRestore}
            isLoading={isRestoring}
            isDisabled={selectedCaseIds.size === 0 || isLoading}
            startContent={!isRestoring && <RefreshCw size={16} />}
          >
            Restore Selected ({selectedCaseIds.size})
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
