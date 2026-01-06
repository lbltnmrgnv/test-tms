'use client';
import { useState, useEffect, useContext } from 'react';
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Tooltip,
  Divider,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  addToast,
  Badge,
} from '@heroui/react';
import {
  Save,
  ArrowLeft,
  ChevronDown,
  CopyPlus,
  CopyMinus,
  RotateCw,
  FileDown,
  FileSpreadsheet,
  FileCode,
  FileJson,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  fetchRun,
  updateRun,
  updateRunCases,
  fetchProjectCases,
  includeExcludeTestCases,
  changeStatus,
  exportRun,
} from '../runsControl';
import RunProgressChart from './RunPregressDonutChart';
import ArboristTree from '../../folders/ArboristTree';
import { useRouter } from '@/src/i18n/routing';
import { testRunStatus } from '@/config/selection';
import { RunType, RunStatusCountType, RunMessages } from '@/types/run';
import { CaseType } from '@/types/case';
import { TokenContext } from '@/utils/TokenProvider';
import { useFormGuard } from '@/utils/formGuard';
import { PriorityMessages } from '@/types/priority';
import { RunStatusMessages, TestRunCaseStatusMessages } from '@/types/status';
import { TestTypeMessages } from '@/types/testType';
import { logError } from '@/utils/errorHandler';

const defaultTestRun = {
  id: 0,
  name: '',
  configurations: 0,
  description: '',
  state: 0,
  projectId: 0,
  createdAt: '',
  updatedAt: '',
};

type Props = {
  projectId: string;
  runId: string;
  messages: RunMessages;
  runStatusMessages: RunStatusMessages;
  testRunCaseStatusMessages: TestRunCaseStatusMessages;
  priorityMessages: PriorityMessages;
  testTypeMessages: TestTypeMessages;
  locale: string;
};

export default function RunEditor({
  projectId,
  runId,
  messages,
  runStatusMessages,
  testRunCaseStatusMessages,
  priorityMessages,
  testTypeMessages,
  locale,
}: Props) {
  const tokenContext = useContext(TokenContext);
  const { theme } = useTheme();
  const [testRun, setTestRun] = useState<RunType>(defaultTestRun);
  const [runStatusCounts, setRunStatusCounts] = useState<RunStatusCountType[]>([]);
  const [testCases, setTestCases] = useState<CaseType[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | undefined>(undefined);
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [isNameInvalid] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();
  useFormGuard(isDirty, messages.areYouSureLeave);

  const fetchRunAndStatusCount = async () => {
    const { run, statusCounts } = await fetchRun(tokenContext.token.access_token, Number(runId));
    setTestRun(run);
    setRunStatusCounts(statusCounts);
  };

  const initTestCases = async () => {
    const casesData = await fetchProjectCases(tokenContext.token.access_token, Number(projectId), Number(runId));
    casesData.forEach((testCase: CaseType) => {
      if (testCase.RunCases && testCase.RunCases.length > 0) {
        testCase.RunCases[0].editState = 'notChanged';
      }
    });
    setTestCases(casesData);
  };

  useEffect(() => {
    async function fetchDataEffect() {
      if (!tokenContext.isSignedIn()) {
        return;
      }

      try {
        await fetchRunAndStatusCount();
        initTestCases();
      } catch (error: unknown) {
        logError('Error fetching run data', error);
      }
    }

    fetchDataEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenContext]);

  // Handle case click from ArboristTree
  const handleCaseClick = (caseData: CaseType) => {
    setSelectedCaseId(caseData.id);
  };

  // Handle selection change from ArboristTree
  const handleSelectionChange = (count: number) => {
    setSelectedCount(count);
  };

  // Handle bulk include/exclude based on tree selection
  const handleBulkIncludeExcludeCases = async (isInclude: boolean) => {
    // This will be handled through ArboristTree's selection
    // For now, we'll show a placeholder
    setIsDirty(true);
    addToast({
      title: 'Info',
      color: 'primary',
      description: isInclude ? 'Include functionality to be implemented' : 'Exclude functionality to be implemented',
    });
  };

  const onSave = async () => {
    setIsUpdating(true);
    await updateRun(tokenContext.token.access_token, testRun);
    await updateRunCases(tokenContext.token.access_token, Number(runId), testCases);
    await initTestCases();

    addToast({
      title: 'Success',
      color: 'success',
      description: messages.updatedTestRun,
    });
    setIsUpdating(false);
    setIsDirty(false);
  };

  return (
    <>
      <div className="border-b-1 dark:border-neutral-700 w-full p-3 flex items-center justify-between">
        <div className="flex items-center">
          <Tooltip content={messages.backToRuns}>
            <Button
              isIconOnly
              size="sm"
              className="rounded-full bg-neutral-50 dark:bg-neutral-600"
              onPress={() => router.push(`/projects/${projectId}/runs`, { locale: locale })}
            >
              <ArrowLeft size={16} />
            </Button>
          </Tooltip>
          <h3 className="font-bold ms-2">{testRun.name}</h3>
        </div>
        <div className="flex items-center">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                variant="bordered"
                size="sm"
                className="me-2"
                startContent={<FileDown size={16} />}
                endContent={<ChevronDown size={16} />}
              >
                {messages.export}
              </Button>
            </DropdownTrigger>
            <DropdownMenu disallowEmptySelection aria-label="Export options">
              <DropdownItem
                key="xml"
                startContent={<FileCode size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'xml')}
              >
                xml
              </DropdownItem>
              <DropdownItem
                key="json"
                startContent={<FileJson size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'json')}
              >
                json
              </DropdownItem>
              <DropdownItem
                key="csv"
                startContent={<FileSpreadsheet size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'csv')}
              >
                csv
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button
            startContent={
              <Badge isInvisible={!isDirty} color="danger" size="sm" content="" shape="circle">
                <Save size={16} />
              </Badge>
            }
            size="sm"
            isDisabled={!tokenContext.isProjectReporter(Number(projectId))}
            color="primary"
            isLoading={isUpdating}
            onPress={onSave}
          >
            {isUpdating ? messages.updating : messages.update}
          </Button>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl pt-6 px-6 flex-grow">
        <div className="flex">
          <div>
            <div className="w-96 h-72">
              <div className="flex items-center">
                <h4 className="font-bold">{messages.progress}</h4>
                <Tooltip content={messages.refresh}>
                  <Button
                    isIconOnly
                    size="sm"
                    className="rounded-full bg-transparent ms-1"
                    onPress={fetchRunAndStatusCount}
                  >
                    <RotateCw size={16} />
                  </Button>
                </Tooltip>
              </div>

              <RunProgressChart
                statusCounts={runStatusCounts}
                testRunCaseStatusMessages={testRunCaseStatusMessages}
                theme={theme}
              />
            </div>
          </div>
          <div className="flex-grow">
            <Input
              size="sm"
              type="text"
              variant="bordered"
              label={messages.title}
              value={testRun.name}
              isInvalid={isNameInvalid}
              errorMessage={isNameInvalid ? messages.pleaseEnter : ''}
              onChange={(e) => {
                setTestRun({ ...testRun, name: e.target.value });
              }}
              className="mt-3"
            />

            <Textarea
              size="sm"
              variant="bordered"
              label={messages.description}
              value={testRun.description}
              onValueChange={(changeValue) => {
                setTestRun({ ...testRun, description: changeValue });
              }}
              className="mt-3"
            />

            <div>
              <Select
                size="sm"
                variant="bordered"
                selectedKeys={[testRunStatus[testRun.state].uid]}
                onSelectionChange={(newSelection) => {
                  if (newSelection !== 'all' && newSelection.size !== 0) {
                    const selectedUid = Array.from(newSelection)[0];
                    const index = testRunStatus.findIndex((template) => template.uid === selectedUid);
                    setTestRun({ ...testRun, state: index });
                  }
                }}
                label={messages.status}
                className="mt-3 max-w-xs"
              >
                {testRunStatus.map((status) => (
                  <SelectItem key={status.uid}>{runStatusMessages[status.uid]}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <Divider className="my-6" />
        <div className="flex items-center justify-between">
          <h6 className="h-8 font-bold">{messages.selectTestCase}</h6>
          <div>
            {selectedCount > 0 && (
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    isDisabled={!tokenContext.isProjectReporter(Number(projectId))}
                    color="primary"
                    endContent={<ChevronDown size={16} />}
                  >
                    {messages.testCaseSelection} ({selectedCount})
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="test case select actions">
                  <DropdownItem
                    key="include"
                    startContent={<CopyPlus size={16} />}
                    onPress={() => handleBulkIncludeExcludeCases(true)}
                  >
                    {messages.includeInRun}
                  </DropdownItem>
                  <DropdownItem
                    key="exclude"
                    startContent={<CopyMinus size={16} />}
                    onPress={() => handleBulkIncludeExcludeCases(false)}
                  >
                    {messages.excludeFromRun}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-small border-2 dark:border-neutral-700 mb-12" style={{ height: '600px' }}>
          <ArboristTree
            projectId={projectId}
            messages={{
              ...messages,
              // Additional messages required by ArboristTree/CasesMessages
              testCaseList: messages.selectTestCase,
              newTestCase: '',
              deleteCase: messages.close,
              areYouSure: '',
              delete: messages.close,
              export: messages.export,
              noCasesFound: messages.noCasesFound,
              caseTitle: messages.title,
              caseDescription: messages.description,
              caseTitleOrDescription: '',
              create: '',
              filter: '',
              clearAll: '',
              apply: '',
              selectPriorities: '',
              selected: '',
              selectTypes: '',
              casesSelected: '',
              selectAction: '',
              move: '',
              clone: '',
              casesMoved: '',
              tags: '',
              casesCloned: '',
              selectTags: '',
              import: '',
              importCases: '',
              importAvailable: '',
              downloadTemplate: '',
              clickToUpload: '',
              orDragAndDrop: '',
              maxFileSize: '',
              casesImported: '',
              createMore: '',
              selectCaseTitle: '',
              selectCaseDescription: '',
            }}
            selectedCaseId={selectedCaseId}
            onCaseClick={handleCaseClick}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      </div>
    </>
  );
}
