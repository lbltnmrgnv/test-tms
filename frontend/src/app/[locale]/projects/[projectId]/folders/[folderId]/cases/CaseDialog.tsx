'use client';
import { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Switch,
} from '@heroui/react';
import { CasesMessages } from '@/types/case';

type Props = {
  isOpen: boolean;
  parentFolderId?: number; // куда создаём кейс
  onCancel: () => void;
  onSubmit: (title: string, description: string, parentFolderId?: number, createMore?: boolean) => void;
  messages: CasesMessages;
};

export default function CaseDialog({ isOpen, parentFolderId, onCancel, onSubmit, messages }: Props) {
  const [caseTitle, setCaseTitle] = useState('Untitled Case');
  const [caseDescription, setCaseDescription] = useState('');
  const [titleError, setTitleError] = useState('');
  const [createMore, setCreateMore] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      clear();
    }
  }, [isOpen]);

  const clear = () => {
    setCaseTitle('Untitled Case');
    setCaseDescription('');
    setTitleError('');
    setCreateMore(false);
  };

  const handleSubmit = () => {
    if (!caseTitle.trim()) {
      setTitleError(messages.pleaseEnter);
      return;
    }

    onSubmit(caseTitle.trim(), caseDescription, parentFolderId, createMore);

    if (!createMore) {
      clear();
      onCancel();
    } else {
      // Сбрасываем поля, диалог остаётся открытым
      setCaseTitle('Untitled Case');
      setCaseDescription('');
      setTitleError('');
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">{messages.newTestCase}</ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <Input
            type="text"
            label={messages.caseTitle}
            value={caseTitle}
            isInvalid={!!titleError}
            errorMessage={titleError}
            onChange={(e) => {
              setCaseTitle(e.target.value);
              setTitleError('');
            }}
          />
          <Textarea
            label={messages.caseDescription}
            value={caseDescription}
            onChange={(e) => setCaseDescription(e.target.value)}
          />
        </ModalBody>
        <ModalFooter className="flex items-center justify-between gap-4">
          <Switch size="sm" isSelected={createMore} onValueChange={setCreateMore}>
            {messages.createMore}
          </Switch>
          <Button color="primary" onPress={handleSubmit}>
            {messages.create}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}