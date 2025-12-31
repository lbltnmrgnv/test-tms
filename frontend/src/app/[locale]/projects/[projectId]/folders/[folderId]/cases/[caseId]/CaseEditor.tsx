'use client';
import { useState, useEffect, useContext, ChangeEvent, DragEvent } from 'react';
import { Input, Textarea, Select, SelectItem, Button, Divider, addToast, Badge, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Avatar } from '@heroui/react';
import { Save, Circle, Pencil } from 'lucide-react';
import CaseStepsEditor from './CaseStepsEditor';
import CaseAttachmentsEditor from './CaseAttachmentsEditor';
import { updateSteps } from './stepControl';
import { fetchCreateAttachments, fetchDownloadAttachment, fetchDeleteAttachment } from './attachmentControl';
import CaseTagsEditor from './CaseTagsEditor';
import UserAvatar from '@/components/UserAvatar';
import { CaseType, AttachmentType, CaseMessages, StepType } from '@/types/case';
import { PriorityMessages } from '@/types/priority';
import { TestTypeMessages } from '@/types/testType';
import { CaseStatusMessages } from '@/types/status';
import { MemberType } from '@/types/user';
import { priorities, testTypes, templates, caseStatus } from '@/config/selection';
import { logError } from '@/utils/errorHandler';
import { fetchCase, updateCase } from '@/utils/caseControl';
import { updateCaseTags } from '@/utils/caseTagsControls';
import { useFormGuard } from '@/utils/formGuard';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchProjectMembers } from '@/src/app/[locale]/projects/[projectId]/members/membersControl';

const defaultTestCase = {
  id: 0,
  title: '',
  state: 0,
  priority: 0,
  type: 0,
  automationStatus: 0,
  description: '',
  template: 0,
  preConditions: '',
  expectedResults: '',
  folderId: 0,
  createdBy: undefined,
  assignedTo: undefined,
  Steps: [],
  Attachments: [],
  isIncluded: false,
  runStatus: 0,
  Tags: [],
  Creator: undefined,
  Assignee: undefined,
};

type Props = {
  projectId: string;
  folderId: string;
  caseId: string;
  messages: CaseMessages;
  testTypeMessages: TestTypeMessages;
  priorityMessages: PriorityMessages;
  caseStatusMessages: CaseStatusMessages;
  locale: string;
  onUpdated?: (updatedCase: CaseType) => void;
};

export default function CaseEditor({
  projectId,
  caseId,
  messages,
  testTypeMessages,
  priorityMessages,
  caseStatusMessages,
  onUpdated,
}: Props) {
  const tokenContext = useContext(TokenContext);
  const [testCase, setTestCase] = useState<CaseType>(defaultTestCase);
  const [isTitleInvalid] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [plusCount, setPlusCount] = useState<number>(0);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedTags, setSelectedTags] = useState<{ id: number; name: string }[]>([]);
  const [isTitleEditing, setIsTitleEditing] = useState<boolean>(false);
  const [projectMembers, setProjectMembers] = useState<MemberType[]>([]);

  useFormGuard(isDirty, messages.areYouSureLeave);

  const onPlusClick = async (newStepNo: number, parentStepId?: number) => {
    setIsDirty(true);
    const newStep: StepType = {
      id: plusCount,
      step: '',
      result: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      caseSteps: {
        stepNo: newStepNo,
      },
      uid: `uid${plusCount}`,
      editState: 'new',
      parentStepId: parentStepId || null,
    };
    setPlusCount(plusCount + 1);

    if (testCase.Steps) {
      const updatedSteps = testCase.Steps.map((step) => {
        // Only update stepNo for steps at the same level (same parent)
        const isSameLevel = parentStepId ? step.parentStepId === parentStepId : !step.parentStepId;

        if (isSameLevel && step.caseSteps.stepNo >= newStepNo) {
          return {
            ...step,
            editState: step.editState === 'notChanged' ? 'changed' : step.editState,
            caseSteps: {
              ...step.caseSteps,
              stepNo: step.caseSteps.stepNo + 1,
            },
          };
        }
        return step;
      });

      updatedSteps.push(newStep);

      setTestCase({
        ...testCase,
        Steps: updatedSteps,
      });
    }
  };

  const onDeleteClick = async (stepId: number) => {
    setIsDirty(true);

    if (testCase.Steps) {
      const deletedStep = testCase.Steps.find((step) => step.id === stepId);
      if (!deletedStep) {
        return;
      }

      const deletedStepNo = deletedStep.caseSteps.stepNo;
      const deletedParentId = deletedStep.parentStepId;

      // Mark the deleted step and all its substeps as deleted
      const markAsDeleted = (stepId: number): void => {
        const step = testCase.Steps?.find((s) => s.id === stepId);
        if (step) {
          step.editState = 'deleted';
          // Find and delete all substeps recursively
          testCase.Steps?.filter((s) => s.parentStepId === stepId).forEach((substep) => {
            markAsDeleted(substep.id);
          });
        }
      };

      markAsDeleted(stepId);

      // Update step numbers for steps at the same level that come after the deleted step
      const updatedSteps = testCase.Steps.map((step) => {
        const isSameLevel = deletedParentId ? step.parentStepId === deletedParentId : !step.parentStepId;

        if (isSameLevel && step.caseSteps.stepNo > deletedStepNo && step.editState !== 'deleted') {
          return {
            ...step,
            editState: step.editState === 'notChanged' ? 'changed' : step.editState,
            caseSteps: {
              ...step.caseSteps,
              stepNo: step.caseSteps.stepNo - 1,
            },
          };
        }
        return step;
      });

      setTestCase({
        ...testCase,
        Steps: updatedSteps,
      });
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      const filesArray = Array.from(event.dataTransfer.files);
      handleFetchCreateAttachments(Number(caseId), filesArray);
    }
  };

  const handleInput = (event: ChangeEvent) => {
    if (event.target) {
      const input = event.target as HTMLInputElement;
      if (input.files) {
        const filesArray = Array.from(input.files);
        handleFetchCreateAttachments(Number(caseId), filesArray);
      }
    }
  };

  const handleFetchCreateAttachments = async (caseId: number, files: File[]) => {
    const newAttachments = await fetchCreateAttachments(caseId, files);

    if (newAttachments) {
      const newAttachmentsWithJoinTable = [];
      newAttachments.forEach((attachment: AttachmentType) => {
        attachment.caseAttachments = {
          createdAt: new Date(),
          updatedAt: new Date(),
          caseId: 0,
          attachmentId: attachment.id,
        };
        newAttachmentsWithJoinTable.push(attachment);
      });
      const updatedAttachments = testCase.Attachments;
      if (updatedAttachments) {
        updatedAttachments.push(...newAttachments);

        setTestCase({
          ...testCase,
          Attachments: updatedAttachments,
        });
      }
    }
  };

  const onAttachmentDelete = async (attachmentId: number) => {
    await fetchDeleteAttachment(attachmentId);
    if (testCase.Attachments) {
      const filteredAttachments = testCase.Attachments.filter((attachment) => attachment.id !== attachmentId);

      setTestCase({
        ...testCase,
        Attachments: filteredAttachments,
      });
    }
  };

  const onStepUpdate = (stepId: number, changeStep: StepType) => {
    if (changeStep.editState === 'notChanged') {
      changeStep.editState = 'changed';
    }

    if (testCase.Steps) {
      setTestCase({
        ...testCase,
        Steps: testCase.Steps.map((step) => {
          if (step.id === stepId) {
            return changeStep;
          } else {
            return step;
          }
        }),
      });
    }
  };

  useEffect(() => {
    const fetchAndSetCase = async () => {
      if (!tokenContext.isSignedIn()) return;
      try {
        const data = await fetchCase(tokenContext.token.access_token, Number(caseId));
        data.Steps.forEach((step: StepType) => {
          step.editState = 'notChanged';
        });
        setTestCase(data);
        if (data.Tags) {
          setSelectedTags(Array.isArray(data.Tags) ? data.Tags : []);
        }
      } catch (error: unknown) {
        logError('Error fetching case data', error);
      }
    };
    fetchAndSetCase();
  }, [tokenContext, caseId]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!tokenContext.isSignedIn()) return;
      try {
        const members = await fetchProjectMembers(tokenContext.token.access_token, projectId);
        setProjectMembers(members || []);
      } catch (error: unknown) {
        logError('Error fetching project members', error);
      }
    };
    fetchMembers();
  }, [tokenContext, projectId]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {/* Fixed Header */}
      <div className="border-b-1 dark:border-neutral-700 w-full p-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            #{testCase.id}
          </span>
          {isTitleEditing ? (
            <Input
              size="sm"
              type="text"
              variant="bordered"
              value={testCase.title}
              autoFocus
              onChange={(e) => {
                setTestCase({ ...testCase, title: e.target.value });
                setIsDirty(true);
              }}
              onBlur={() => setIsTitleEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsTitleEditing(false);
                }
              }}
              className="max-w-md"
            />
          ) : (
            <span
              className="text-sm font-medium text-neutral-800 dark:text-neutral-200 cursor-text"
              onDoubleClick={() => {
                if (tokenContext.isProjectDeveloper(Number(projectId))) {
                  setIsTitleEditing(true);
                }
              }}
            >
              {testCase.title || 'Untitled'}
            </span>
          )}
        </div>
        <div className="flex items-center">
          <Button
            startContent={
              <Badge isInvisible={!isDirty} color="danger" size="sm" content="" shape="circle">
                <Save size={16} />
              </Badge>
            }
            size="sm"
            isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
            color="primary"
            isLoading={isUpdating}
            onPress={async () => {
              setIsUpdating(true);
              try {
                await updateCase(tokenContext.token.access_token, testCase);
                if (testCase.Steps) {
                  await updateSteps(tokenContext.token.access_token, Number(caseId), testCase.Steps);
                }

                const tagIds = selectedTags.map((tag) => tag.id);
                await updateCaseTags(tokenContext.token.access_token, Number(caseId), tagIds, projectId);

                addToast({
                  title: 'Success',
                  color: 'success',
                  description: messages.updatedTestCase,
                });
                setIsDirty(false);
                onUpdated?.(testCase);
              } catch (error) {
                logError('Error updating test case', error);
                addToast({
                  title: 'Error',
                  description: messages.errorUpdatingTestCase,
                  color: 'danger',
                });
              } finally {
                setIsUpdating(false);
              }
            }}
          >
            {isUpdating ? messages.updating : messages.update}
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Main Content (Left Column) */}
        <div
          className="p-5"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Textarea
            size="sm"
            variant="bordered"
            label={messages.description}
            placeholder={messages.testCaseDescription}
            value={testCase.description}
            onValueChange={(changeValue) => {
              setTestCase({ ...testCase, description: changeValue });
              setIsDirty(true);
            }}
            minRows={3}
          />

          <Divider className="my-6" />
          <div>
            <h6 className="font-bold mb-3">{messages.steps}</h6>
            {testCase.Steps && (
              <CaseStepsEditor
                isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
                steps={testCase.Steps}
                onStepUpdate={onStepUpdate}
                onStepPlus={onPlusClick}
                onStepDelete={onDeleteClick}
                messages={messages}
                onDirtyChange={() => setIsDirty(true)}
              />
            )}
          </div>

          <Divider className="my-6" />
          <h6 className="font-bold">{messages.attachments}</h6>
          {testCase.Attachments && (
            <CaseAttachmentsEditor
              isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
              attachments={testCase.Attachments}
              onAttachmentDownload={(attachmentId: number, downloadFileName: string) =>
                fetchDownloadAttachment(attachmentId, downloadFileName)
              }
              onAttachmentDelete={onAttachmentDelete}
              onFilesDrop={handleDrop}
              onFilesInput={handleInput}
              messages={messages}
            />
          )}
        </div>

        {/* Right Sidebar (Metadata Panel) */}
        <div
          className="border-l-1 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
          style={{
            width: '320px',
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          <div className="p-4 space-y-4">
            {/* Created Date */}
            <div>
              <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                {messages.createdAt}
              </div>
              <div className="text-sm text-neutral-800 dark:text-neutral-200">
                {formatDate(testCase.createdAt)}
              </div>
            </div>

            <Divider />

            {/* Assign */}
            <div>
              <Select
                size="sm"
                variant="bordered"
                label={messages.assign}
                placeholder={messages.noAssignee}
                selectedKeys={testCase.assignedTo ? [String(testCase.assignedTo)] : []}
                onSelectionChange={(keys) => {
                  if (keys === 'all') return;
                  const selectedKey = Array.from(keys)[0];
                  const assignedTo = selectedKey ? Number(selectedKey) : undefined;
                  setTestCase({ ...testCase, assignedTo });
                  setIsDirty(true);
                }}
                isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
                classNames={{
                  trigger: "h-12",
                }}
                renderValue={(items) => {
                  return items.map((item) => {
                    const member = projectMembers.find((m) => String(m.User.id) === item.key);
                    if (!member) return null;
                    return (
                      <div key={item.key} className="flex items-center gap-2">
                        <UserAvatar
                          size={24}
                          username={member.User.username}
                          avatarPath={member.User.avatarPath}
                        />
                        <span>{member.User.username}</span>
                      </div>
                    );
                  });
                }}
              >
                {projectMembers.map((member) => (
                  <SelectItem
                    key={String(member.User.id)}
                    textValue={member.User.username}
                    startContent={
                      <UserAvatar
                        size={24}
                        username={member.User.username}
                        avatarPath={member.User.avatarPath}
                      />
                    }
                  >
                    {member.User.username}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <Divider />

            {/* Tags */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  {messages.tags}
                </span>
                {tokenContext.isProjectDeveloper(Number(projectId)) && (
                  <Pencil size={12} className="text-neutral-400" />
                )}
              </div>
              <CaseTagsEditor
                projectId={projectId}
                selectedTags={selectedTags}
                onChange={(tags) => {
                  setSelectedTags(tags);
                  setIsDirty(true);
                }}
                messages={messages}
              />
            </div>

            <Divider />

            {/* Author */}
            <div>
              <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2 flex items-center gap-2">
                {messages.author}
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                {testCase.Creator ? (
                  <>
                    <UserAvatar
                      size={24}
                      username={testCase.Creator.username}
                      avatarPath={testCase.Creator.avatarPath}
                    />
                    <span>{testCase.Creator.username}</span>
                  </>
                ) : (
                  <span className="text-neutral-500">{messages.noAuthor}</span>
                )}
              </div>
            </div>

            <Divider />

            {/* Status */}
            <div>
              <Select
                size="sm"
                variant="bordered"
                label={messages.status}
                selectedKeys={[caseStatus[testCase.state].uid]}
                onSelectionChange={(keys) => {
                  if (keys === 'all') return;
                  const selectedUid = Array.from(keys)[0];
                  const index = caseStatus.findIndex((status) => status.uid === selectedUid);
                  if (index !== -1 && index !== testCase.state) {
                    setTestCase({ ...testCase, state: index });
                    setIsDirty(true);
                  }
                }}
                startContent={
                  <Circle
                    size={8}
                    color={caseStatus[testCase.state].iconColor}
                    fill={caseStatus[testCase.state].iconColor}
                  />
                }
                isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
              >
                {caseStatus.map((status) => (
                  <SelectItem
                    key={status.uid}
                    startContent={<Circle size={8} color={status.iconColor} fill={status.iconColor} />}
                  >
                    {caseStatusMessages[status.uid]}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <Divider />

            {/* Priority */}
            <div>
              <Select
                size="sm"
                variant="bordered"
                label={messages.priority}
                selectedKeys={[priorities[testCase.priority].uid]}
                onSelectionChange={(keys) => {
                  if (keys === 'all') return;
                  const selectedUid = Array.from(keys)[0];
                  const index = priorities.findIndex((priority) => priority.uid === selectedUid);
                  setTestCase({ ...testCase, priority: index });
                  setIsDirty(true);
                }}
                startContent={
                  <Circle
                    size={8}
                    color={priorities[testCase.priority].color}
                    fill={priorities[testCase.priority].color}
                  />
                }
                isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
              >
                {priorities.map((priority) => (
                  <SelectItem key={priority.uid}>{priorityMessages[priority.uid]}</SelectItem>
                ))}
              </Select>
            </div>

            <Divider />

            {/* Type */}
            <div>
              <Select
                size="sm"
                variant="bordered"
                label={messages.type}
                selectedKeys={[testTypes[testCase.type].uid]}
                onSelectionChange={(keys) => {
                  if (keys === 'all') return;
                  const selectedUid = Array.from(keys)[0];
                  const index = testTypes.findIndex((type) => type.uid === selectedUid);
                  setTestCase({ ...testCase, type: index });
                  setIsDirty(true);
                }}
                isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
              >
                {testTypes.map((type) => (
                  <SelectItem key={type.uid}>{testTypeMessages[type.uid]}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
