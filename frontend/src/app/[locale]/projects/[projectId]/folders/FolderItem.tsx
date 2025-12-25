import { Button } from '@heroui/react';
import { ChevronDown, ChevronRight, Folder, Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { FolderType, FoldersMessages, TreeNodeData } from '@/types/folder';
import TreeItem from '@/components/TreeItem';
import { useRouter } from '@/src/i18n/routing';
import FolderEditMenu from './FolderEditMenu';

interface FolderItemProps {
  node: TreeNodeData;
  style: React.CSSProperties;
  isOpen: boolean;
  toggle: () => void;
  projectId: string;
  selectedFolder: FolderType | null;
  locale: string;
  messages: FoldersMessages;
  openDialogForCreate: (folderId: number | null) => void;
  onEditClick: (folder: FolderType) => void;
  onDeleteClick: (folderId: number) => void;
}

export default function FolderItem({
                                     node,
                                     style,
                                     isOpen,
                                     toggle,
                                     projectId,
                                     selectedFolder,
                                     locale,
                                     messages,
                                     openDialogForCreate,
                                     onEditClick,
                                     onDeleteClick,
                                   }: FolderItemProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isSelected = selectedFolder?.id === node.folderData.id;
  const canExpand = (node.children?.length ?? 0) > 0 || !node.isCasesLoaded;

  // Одна функция для клика на папку и стрелку
  const handleFolderClick = () => {
    toggle(); // раскрытие + подгрузка кейсов

    const params = new URLSearchParams(searchParams.toString());
    const qs = params.toString();
    const url = `/projects/${projectId}/folders/${node.folderData.id}/cases${qs ? `?${qs}` : ''}`;
    router.push(url, { locale });
  };

  const toggleButton = canExpand ? (
    <Button
      size="sm"
      className="bg-transparent rounded-full h-6 w-6 min-w-4"
      isIconOnly
      onPress={handleFolderClick}
    >
      {isOpen ? (
        <ChevronDown size={20} color="#F7C24E" />
      ) : (
        <ChevronRight size={20} color="#F7C24E" />
      )}
    </Button>
  ) : null;

  const actions = (
    <>
      <Button
        size="sm"
        isIconOnly
        className="bg-transparent rounded-full"
        onPress={() => openDialogForCreate(node.folderData.id)}
      >
        <Plus size={16} />
      </Button>

      <FolderEditMenu
        folder={node.folderData}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        messages={messages}
        isDisabled={false}
      />
    </>
  );

  return (
    <TreeItem
      style={style}
      isSelected={isSelected}
      onClick={handleFolderClick}
      toggleButton={toggleButton}
      icon={<Folder size={20} color="#F7C24E" fill="#F7C24E" />}
      label={node.name}
      actions={actions}
    />
  );
}