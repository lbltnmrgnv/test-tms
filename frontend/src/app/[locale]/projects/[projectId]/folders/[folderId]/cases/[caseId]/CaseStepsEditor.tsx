import { useState, useMemo, useRef, useEffect, KeyboardEvent } from 'react';
import { Input, Button } from '@heroui/react';
import { ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';
import { CaseMessages, StepType } from '@/types/case';

type Props = {
  isDisabled: boolean;
  steps: StepType[];
  onStepUpdate: (stepId: number, step: StepType) => void;
  onStepPlus: (newStepNo: number, parentStepId?: number) => void;
  onStepDelete: (stepId: number) => void;
  messages: CaseMessages;
  onDirtyChange: () => void;
};

export default function StepsEditor({
  isDisabled,
  steps,
  onStepUpdate,
  onStepPlus,
  onStepDelete,
  messages,
  onDirtyChange
}: Props) {
  const [collapsedSteps, setCollapsedSteps] = useState<Set<number>>(new Set());
  const [focusedStepId, setFocusedStepId] = useState<number | null>(null);
  const stepRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const [pendingStepValue, setPendingStepValue] = useState<string>('');

  // Build hierarchical structure from flat steps array
  const hierarchicalSteps = useMemo(() => {
    const sortedSteps = steps
      .slice()
      .filter((entry) => entry.editState !== 'deleted')
      .sort((a, b) => a.caseSteps.stepNo - b.caseSteps.stepNo);

    const stepMap = new Map<number, StepType>();
    const rootSteps: StepType[] = [];

    // First pass: create map of all steps
    sortedSteps.forEach((step) => {
      stepMap.set(step.id, { ...step, substeps: [] });
    });

    // Second pass: build hierarchy
    sortedSteps.forEach((step) => {
      const stepWithSubsteps = stepMap.get(step.id);
      if (!stepWithSubsteps) return;

      if (step.parentStepId && stepMap.has(step.parentStepId)) {
        const parent = stepMap.get(step.parentStepId);
        if (parent) {
          parent.substeps = parent.substeps || [];
          parent.substeps.push(stepWithSubsteps);
        }
      } else {
        rootSteps.push(stepWithSubsteps);
      }
    });

    return rootSteps;
  }, [steps]);

  // Apply pending value to newly created step, then focus it
  useEffect(() => {
    if (pendingStepValue && steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      if (lastStep && lastStep.step === '') {
        onStepUpdate(lastStep.id, { ...lastStep, step: pendingStepValue });
        setPendingStepValue('');

        // Focus the step after value is applied
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          const element = stepRefs.current.get(lastStep.id);
          if (element) {
            element.focus();
            // Move cursor to end of input
            const length = pendingStepValue.length;
            element.setSelectionRange(length, length);
          }
        });
      }
    }
  }, [steps, pendingStepValue, onStepUpdate]);

  // Focus management - automatically focus newly created steps (for non-auto-created steps)
  useEffect(() => {
    if (focusedStepId !== null) {
      // Use requestAnimationFrame for more reliable focus timing
      requestAnimationFrame(() => {
        const element = stepRefs.current.get(focusedStepId);
        if (element) {
          element.focus();
          setFocusedStepId(null);
        }
      });
    }
  }, [focusedStepId, steps]);

  const toggleCollapse = (stepId: number) => {
    setCollapsedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const getStepNumber = (step: StepType, parentNumber?: string): string => {
    if (parentNumber) {
      const parentSteps = steps.filter(
        (s) => s.parentStepId === step.parentStepId && s.editState !== 'deleted'
      );
      const sortedParentSteps = parentSteps.sort((a, b) => a.caseSteps.stepNo - b.caseSteps.stepNo);
      const substepIndex = sortedParentSteps.findIndex((s) => s.id === step.id);
      return `${parentNumber}.${substepIndex + 1}`;
    }
    const rootSteps = steps.filter((s) => !s.parentStepId && s.editState !== 'deleted');
    const sortedRootSteps = rootSteps.sort((a, b) => a.caseSteps.stepNo - b.caseSteps.stepNo);
    const rootIndex = sortedRootSteps.findIndex((s) => s.id === step.id);
    return `${rootIndex + 1}`;
  };

  // Get the next step ID after creation
  const getNextStepId = () => {
    const maxId = Math.max(0, ...steps.map(s => s.id));
    return maxId + 1;
  };

  // Helper function to flatten hierarchical steps into display order
  const flattenSteps = (hierarchical: StepType[]): StepType[] => {
    const result: StepType[] = [];
    const traverse = (stepList: StepType[]) => {
      stepList.forEach((step) => {
        result.push(step);
        if (step.substeps && step.substeps.length > 0) {
          traverse(step.substeps);
        }
      });
    };
    traverse(hierarchical);
    return result;
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    step: StepType
  ) => {
    // Backspace key - delete step if empty and focus previous step
    if (e.key === 'Backspace' && step.step === '') {
      e.preventDefault();

      // Get flattened steps in display order (respecting hierarchy)
      const flattenedSteps = flattenSteps(hierarchicalSteps);
      const currentIndex = flattenedSteps.findIndex((s) => s.id === step.id);

      if (currentIndex > 0) {
        const previousStep = flattenedSteps[currentIndex - 1];
        setFocusedStepId(previousStep.id);
      }

      onStepDelete(step.id);
      onDirtyChange();
      return;
    }

    // Enter key - create sibling step at same level
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      onDirtyChange();

      const nextStepId = getNextStepId();
      onStepPlus(step.caseSteps.stepNo + 1, step.parentStepId || undefined);

      // Schedule focus for the new step
      setTimeout(() => {
        setFocusedStepId(nextStepId);
      }, 0);
    }

    // Tab key - create substep (child step)
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      onDirtyChange();

      const nextStepId = getNextStepId();
      onStepPlus(1, step.id);

      // Expand parent step if collapsed
      if (collapsedSteps.has(step.id)) {
        setCollapsedSteps((prev) => {
          const newSet = new Set(prev);
          newSet.delete(step.id);
          return newSet;
        });
      }

      // Schedule focus for the new substep
      setTimeout(() => {
        setFocusedStepId(nextStepId);
      }, 0);
    }
  };

  const registerRef = (stepId: number, element: HTMLInputElement | null) => {
    if (element) {
      stepRefs.current.set(stepId, element);
    } else {
      stepRefs.current.delete(stepId);
    }
  };

  const renderStep = (step: StepType, level: number = 0, parentNumber?: string): JSX.Element => {
    const stepNumber = getStepNumber(step, parentNumber);
    const hasSubsteps = step.substeps && step.substeps.length > 0;
    const isCollapsed = collapsedSteps.has(step.id);
    const indentClass = level > 0 ? 'ml-8' : '';

    return (
      <div key={step.id} className={indentClass}>
        <div className="flex items-center gap-2 py-0.5 group hover:bg-neutral-50 dark:hover:bg-neutral-800/30 rounded-md px-1">
          {/* Drag Handle */}
          <div className="flex items-center text-neutral-400 dark:text-neutral-600 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical size={16} />
          </div>

          {/* Collapse Toggle and Step Number */}
          <div className="flex items-center gap-1 min-w-[50px]">
            {hasSubsteps ? (
              <button
                className="w-4 h-4 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                onClick={() => toggleCollapse(step.id)}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : (
              <div className="w-4" />
            )}
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 min-w-[24px]">
              {stepNumber}
            </span>
          </div>

          {/* Step Content - Single line input */}
          <div className="flex-1">
            <Input
              ref={(el) => registerRef(step.id, el)}
              size="sm"
              variant="underlined"
              placeholder={messages.detailsOfTheStep}
              value={step.step}
              isDisabled={isDisabled}
              classNames={{
                input: "text-sm",
                inputWrapper: "shadow-none border-b-1 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 data-[focus=true]:border-primary"
              }}
              onValueChange={(changeValue) => {
                onStepUpdate(step.id, { ...step, step: changeValue });
                onDirtyChange();
              }}
              onKeyDown={(e) => handleKeyDown(e, step)}
            />
          </div>
        </div>

        {/* Render Substeps */}
        {hasSubsteps && !isCollapsed && (
          <div className="ml-6">
            {step.substeps?.map((substep) => renderStep(substep, level + 1, stepNumber))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0">
      {/* Scenario Title */}
      <h6 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
        Scenario
      </h6>

      {hierarchicalSteps.length === 0 ? (
        // Empty state with interactive input field
        <div className="py-2">
          <Input
            size="sm"
            variant="underlined"
            placeholder="Describe the action. Press Enter to add the next step."
            isDisabled={isDisabled}
            classNames={{
              input: "text-sm",
              inputWrapper: "shadow-none border-b-1 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 data-[focus=true]:border-primary"
            }}
            onValueChange={(value) => {
              if (value.length > 0) {
                // Auto-create first step when user starts typing
                setPendingStepValue(value);
                onStepPlus(1);
                onDirtyChange();
                // Focus will be handled by the pendingStepValue useEffect
              }
            }}
            onKeyDown={(e) => {
              // Handle Enter key in empty state
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const target = e.target as HTMLInputElement;
                if (target.value.length > 0) {
                  e.preventDefault();
                  setPendingStepValue(target.value);
                  onStepPlus(1);
                  onDirtyChange();
                  // Focus will be handled by the pendingStepValue useEffect
                }
              }
            }}
          />
        </div>
      ) : (
        <div className="space-y-0">
          {hierarchicalSteps.map((step) => renderStep(step))}
        </div>
      )}

      {/* Add Step Button at the bottom */}
      <div className="flex items-center gap-2 mt-2 pt-2">
        <Button
          startContent={<Plus size={14} />}
          size="sm"
          variant="light"
          isDisabled={isDisabled}
          className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          onPress={() => {
            const maxStepNo = Math.max(
              0,
              ...steps
                .filter((s) => !s.parentStepId && s.editState !== 'deleted')
                .map((s) => s.caseSteps.stepNo)
            );
            const nextStepId = getNextStepId();
            onStepPlus(maxStepNo + 1);
            onDirtyChange();

            // Focus the newly created step
            setTimeout(() => {
              setFocusedStepId(nextStepId);
            }, 0);
          }}
        >
          {messages.addStep}
        </Button>
      </div>
    </div>
  );
}
