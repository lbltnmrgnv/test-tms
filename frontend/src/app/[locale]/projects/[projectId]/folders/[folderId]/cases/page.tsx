import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import CasesPane from './CasesPane';
import { PriorityMessages } from '@/types/priority';
import { TestTypeMessages } from '@/types/testType';
import { CaseStatusMessages } from '@/types/status';
import { CaseMessages } from '@/types/case';
import { LocaleCodeType } from '@/types/locale';

export async function generateMetadata({ params: { locale } }: { params: { locale: LocaleCodeType } }) {
  const t = await getTranslations({ locale, namespace: 'Cases' });
  return {
    title: `${t('test_case_list')} | TestTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page({ params }: { params: { projectId: string; folderId: string; locale: string } }) {
  const t = useTranslations('Cases');
  const messages = {
    testCaseList: t('test_case_list'),
    id: t('id'),
    title: t('title'),
    priority: t('priority'),
    actions: t('actions'),
    deleteCase: t('delete_case'),
    delete: t('delete'),
    close: t('close'),
    areYouSure: t('are_you_sure'),
    newTestCase: t('new_test_case'),
    export: t('export'),
    status: t('status'),
    noCasesFound: t('no_cases_found'),
    caseTitle: t('case_title'),
    caseDescription: t('case_description'),
    caseTitleOrDescription: t('case_title_or_description'),
    create: t('create'),
    pleaseEnter: t('please_enter'),
    apply: t('apply'),
    filter: t('filter'),
    clearAll: t('clear_all'),
    selectPriorities: t('select_priorities'),
    selected: t('selected'),
    type: t('type'),
    selectTypes: t('select_types'),
    casesSelected: t('cases_selected'),
    selectAction: t('select_action'),
    move: t('move'),
    clone: t('clone'),
    casesMoved: t('cases_moved'),
    casesCloned: t('cases_cloned'),
    tags: t('tags'),
    selectTags: t('select_tags'),
    import: t('import'),
    importCases: t('import_cases'),
    importAvailable: t('import_available'),
    downloadTemplate: t('download_template'),
    clickToUpload: t('click_to_upload'),
    orDragAndDrop: t('or_drag_and_drop'),
    maxFileSize: t('max_file_size'),
    casesImported: t('cases_imported'),
    createMore: t('create_more'),
    selectCaseTitle: t('select_case_title'),
    selectCaseDescription: t('select_case_description'),
  };

  const priorityTranslation = useTranslations('Priority');
  const priorityMessages: PriorityMessages = {
    critical: priorityTranslation('critical'),
    high: priorityTranslation('high'),
    medium: priorityTranslation('medium'),
    low: priorityTranslation('low'),
  };

  const testTypeTranslation = useTranslations('Type');
  const testTypeMessages: TestTypeMessages = {
    other: testTypeTranslation('other'),
    security: testTypeTranslation('security'),
    performance: testTypeTranslation('performance'),
    accessibility: testTypeTranslation('accessibility'),
    functional: testTypeTranslation('functional'),
    acceptance: testTypeTranslation('acceptance'),
    usability: testTypeTranslation('usability'),
    smokeSanity: testTypeTranslation('smoke_sanity'),
    compatibility: testTypeTranslation('compatibility'),
    destructive: testTypeTranslation('destructive'),
    regression: testTypeTranslation('regression'),
    automated: testTypeTranslation('automated'),
    manual: testTypeTranslation('manual'),
  };

  const caseStatusTranslation = useTranslations('CaseStatus');
  const caseStatusMessages: CaseStatusMessages = {
    draft: caseStatusTranslation('draft'),
    active: caseStatusTranslation('active'),
    deprecated: caseStatusTranslation('deprecated'),
  };

  const tc = useTranslations('Case');
  const caseMessages: CaseMessages = {
    backToCases: tc('back_to_cases'),
    updating: tc('updating'),
    update: tc('update'),
    updatedTestCase: tc('updated_test_case'),
    basic: tc('basic'),
    title: tc('title'),
    pleaseEnterTitle: tc('please_enter_title'),
    description: tc('description'),
    testCaseDescription: tc('test_case_description'),
    status: tc('status'),
    priority: tc('priority'),
    type: tc('type'),
    template: tc('template'),
    testDetail: tc('test_detail'),
    preconditions: tc('preconditions'),
    expectedResult: tc('expected_result'),
    step: tc('step'),
    text: tc('text'),
    steps: tc('steps'),
    newStep: tc('new_step'),
    detailsOfTheStep: tc('details_of_the_step'),
    deleteThisStep: tc('delete_this_step'),
    insertStep: tc('insert_step'),
    attachments: tc('attachments'),
    delete: tc('delete'),
    download: tc('download'),
    deleteFile: tc('delete_file'),
    clickToUpload: tc('click_to_upload'),
    orDragAndDrop: tc('or_drag_and_drop'),
    maxFileSize: tc('max_file_size'),
    areYouSureLeave: tc('are_you_sure_leave'),
    tags: tc('tags'),
    createTag: tc('create_tag'),
    maxTagsLimit: tc('max_tags_limit'),
    tagAlreadyExists: tc('tag_already_exists'),
    tagCreatedAndAdded: tc('tag_created_and_added'),
    errorCreatingTag: tc('error_creating_tag'),
    errorUpdatingTestCase: tc('error_updating_test_case'),
    searchOrCreateTag: tc('search_or_create_tag'),
    noTagsSelected: tc('no_tags_selected'),
    noStepsYet: tc('no_steps_yet'),
    addStep: tc('add_step'),
    owner: tc('owner'),
    assignedTo: tc('assigned_to'),
    noOwner: tc('no_owner'),
    noAssignee: tc('no_assignee'),
    author: tc('author'),
    assign: tc('assign'),
    noAuthor: tc('no_author'),
    createdAt: tc('created_at'),
  };

  return (
    <>
      <CasesPane
        projectId={params.projectId}
        folderId={params.folderId}
        locale={params.locale as LocaleCodeType}
        messages={messages}
        caseMessages={caseMessages}
        priorityMessages={priorityMessages}
        testTypeMessages={testTypeMessages}
        caseStatusMessages={caseStatusMessages}
      />
    </>
  );
}
