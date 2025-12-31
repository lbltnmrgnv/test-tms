'use client';
import { useState, useEffect, useContext, useRef } from 'react';
import { Circle, X, Search } from 'lucide-react';
import { FilterOptions, FilterChip, FilterType } from '@/types/filter';
import { priorities, testTypes, caseStatus } from '@/config/selection';
import { fetchTags } from '@/utils/tagsControls';
import { fetchProjectMembers } from '@/src/app/[locale]/projects/[projectId]/members/membersControl';
import { TokenContext } from '@/utils/TokenProvider';
import { PriorityMessages } from '@/types/priority';
import { TestTypeMessages } from '@/types/testType';
import { CaseStatusMessages } from '@/types/status';
import { TagType } from '@/types/tag';
import { MemberType } from '@/types/user';
import UserAvatar from '@/components/UserAvatar';

type Tag = Pick<TagType, 'id' | 'name'>;

interface Props {
  projectId: string;
  value: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  priorityMessages?: PriorityMessages;
  testTypeMessages?: TestTypeMessages;
  caseStatusMessages?: CaseStatusMessages;
  placeholder?: string;
}

export default function AdvancedFilterInput({
                                              projectId,
                                              value,
                                              onChange,
                                              priorityMessages,
                                              testTypeMessages,
                                              caseStatusMessages,
                                              placeholder = 'Search or add filter...',
                                            }: Props) {
  const context = useContext(TokenContext);
  const [chips, setChips] = useState<FilterChip[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isMainDropdownOpen, setIsMainDropdownOpen] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState<FilterType | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [members, setMembers] = useState<MemberType[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [editingChipId, setEditingChipId] = useState<string | null>(null);
  const [incompleteChip, setIncompleteChip] = useState<FilterType | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load tags and members
  useEffect(() => {
    const loadData = async () => {
      const tagsData = await fetchTags(context.token.access_token, projectId);
      setTags(tagsData || []);

      const membersData = await fetchProjectMembers(context.token.access_token, projectId);
      setMembers(membersData || []);
    };
    loadData();
  }, [projectId, context.token.access_token]);

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      addChip('text', inputValue.trim(), inputValue.trim());
      setInputValue('');
    }
    if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      removeChip(chips[chips.length - 1].id);
    }
  };

  // Add chip
  const addChip = (type: FilterType, label: string, value: string | number) => {
    // If editing existing chip - remove it
    let baseChips = chips;
    if (editingChipId) {
      baseChips = chips.filter((c) => c.id !== editingChipId);
      setEditingChipId(null);
    }

    // Remove incomplete chip
    setIncompleteChip(null);

    // For text - replace previous
    if (type === 'text') {
      const newChips = baseChips.filter((c) => c.type !== 'text');
      const newChip = { id: `text-${Date.now()}`, type, label, value };
      const updatedChips = [...newChips, newChip];
      setChips(updatedChips);
      setActiveFilterType(null);
      applyFiltersFromChips(updatedChips);
      return;
    }

    // Check for duplicates for priority, type, tag, status
    const isDuplicate = baseChips.some((c) => c.type === type && c.value === value);
    if (isDuplicate) {
      setActiveFilterType(null);
      return;
    }

    const newChip = { id: `${type}-${value}-${Date.now()}`, type, label, value };
    const updatedChips = [...baseChips, newChip];
    setChips(updatedChips);
    setActiveFilterType(null);

    // Auto-apply
    applyFiltersFromChips(updatedChips);
  };

  // Remove chip
  const removeChip = (chipId: string) => {
    const newChips = chips.filter((c) => c.id !== chipId);
    setChips(newChips);
    applyFiltersFromChips(newChips);
  };

  // Apply filters from chips
  const applyFiltersFromChips = (currentChips: FilterChip[]) => {
    const filters: FilterOptions = {};

    const textChips = currentChips.filter((c) => c.type === 'text');
    if (textChips.length > 0) {
      filters.search = textChips[textChips.length - 1].value as string;
    }

    const priorityChips = currentChips.filter((c) => c.type === 'priority');
    if (priorityChips.length > 0) {
      filters.priorities = priorityChips.map((c) => c.value as number);
    }

    const typeChips = currentChips.filter((c) => c.type === 'type');
    if (typeChips.length > 0) {
      filters.types = typeChips.map((c) => c.value as number);
    }

    const tagChips = currentChips.filter((c) => c.type === 'tag');
    if (tagChips.length > 0) {
      filters.tags = tagChips.map((c) => c.value as number);
    }

    const statusChips = currentChips.filter((c) => c.type === 'status');
    if (statusChips.length > 0) {
      filters.statuses = statusChips.map((c) => c.value as number);
    }

    const authorChips = currentChips.filter((c) => c.type === 'author');
    if (authorChips.length > 0) {
      filters.authors = authorChips.map((c) => c.value as number);
    }

    const assigneeChips = currentChips.filter((c) => c.type === 'assignee');
    if (assigneeChips.length > 0) {
      filters.assignees = assigneeChips.map((c) => c.value as number);
    }

    onChange(filters);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setChips([]);
    setInputValue('');
    onChange({});
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    // Close dropdown when typing
    if (e.target.value) {
      setIsMainDropdownOpen(false);
    }
  };

  // Handle chip click to edit value
  const handleChipClick = (chip: FilterChip, e: React.MouseEvent) => {
    e.stopPropagation();
    if (chip.type !== 'text') {
      setEditingChipId(chip.id);
      setActiveFilterType(chip.type);
    }
  };

  // Render main dropdown with filter types
  const renderMainDropdown = () => {
    if (!isMainDropdownOpen) return null;

    const handleFilterTypeClick = (filterType: FilterType) => {
      setIncompleteChip(filterType);
      setActiveFilterType(filterType);
      setIsMainDropdownOpen(false);
    };

    return (
      <div className="filter-dropdown">
        <button
          onClick={() => handleFilterTypeClick('priority')}
          className="filter-dropdown-button"
        >
          Priority
        </button>
        <button
          onClick={() => handleFilterTypeClick('type')}
          className="filter-dropdown-button"
        >
          Type
        </button>
        <button
          onClick={() => handleFilterTypeClick('status')}
          className="filter-dropdown-button"
        >
          Status
        </button>
        <button
          onClick={() => handleFilterTypeClick('tag')}
          className="filter-dropdown-button"
        >
          Tags
        </button>
        <button
          onClick={() => handleFilterTypeClick('author')}
          className="filter-dropdown-button"
        >
          Author
        </button>
        <button
          onClick={() => handleFilterTypeClick('assignee')}
          className="filter-dropdown-button"
        >
          Assignee
        </button>
      </div>
    );
  };

  // Render secondary dropdown for value selection
  const renderSecondaryDropdown = () => {
    if (!activeFilterType) return null;

    switch (activeFilterType) {
      case 'priority': {
        return (
          <div className="filter-dropdown-secondary">
            <div style={{ padding: 8 }}>
              {priorities.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => addChip('priority', `Priority|${priorityMessages?.[p.uid] ?? p.uid}`, idx)}
                  className="filter-dropdown-button-flex"
                >
                  <Circle size={8} color={p.color} fill={p.color} />
                  <span>{priorityMessages?.[p.uid]}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'type': {
        return (
          <div className="filter-dropdown-secondary">
            <div style={{ padding: 8, maxHeight: 300, overflowY: 'auto' }}>
              {testTypes.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => addChip('type', `Type|${testTypeMessages?.[t.uid] ?? t.uid}`, idx)}
                  className="filter-dropdown-button"
                >
                  {testTypeMessages?.[t.uid]}
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'status': {
        return (
          <div className="filter-dropdown-secondary">
            <div style={{ padding: 8 }}>
              {caseStatus.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => addChip('status', `Status|${caseStatusMessages?.[s.uid] ?? s.uid}`, idx)}
                  className="filter-dropdown-button-flex"
                >
                  <Circle size={8} color={s.iconColor} fill={s.iconColor} />
                  <span>{caseStatusMessages?.[s.uid]}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'tag': {
        const filteredTags = tags.filter((tag) =>
          tag.name.toLowerCase().includes(tagSearchInput.toLowerCase())
        );

        return (
          <div className="filter-dropdown-secondary">
            <div style={{ padding: 8 }}>
              <input
                type="text"
                value={tagSearchInput}
                onChange={(e) => setTagSearchInput(e.target.value)}
                placeholder="Search tags..."
                autoFocus
                className="filter-tag-search-input"
              />
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {filteredTags.length === 0 ? (
                  <div style={{ padding: '8px 12px', opacity: 0.6, fontSize: 14 }}>
                    No tags found
                  </div>
                ) : (
                  filteredTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        addChip('tag', `Tag|${tag.name}`, tag.id);
                        setTagSearchInput('');
                      }}
                      className="filter-dropdown-button"
                    >
                      {tag.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'author': {
        const filteredMembers = members.filter((member) =>
          member.User.username.toLowerCase().includes(memberSearchInput.toLowerCase())
        );

        return (
          <div className="filter-dropdown-secondary">
            <div style={{ padding: 8 }}>
              <input
                type="text"
                value={memberSearchInput}
                onChange={(e) => setMemberSearchInput(e.target.value)}
                placeholder="Search authors..."
                autoFocus
                className="filter-tag-search-input"
              />
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {filteredMembers.length === 0 ? (
                  <div style={{ padding: '8px 12px', opacity: 0.6, fontSize: 14 }}>
                    No members found
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <button
                      key={member.User.id}
                      onClick={() => {
                        addChip('author', `Author|${member.User.username}`, member.User.id as number);
                        setMemberSearchInput('');
                      }}
                      className="filter-dropdown-button-flex"
                    >
                      <UserAvatar
                        size={24}
                        username={member.User.username}
                        avatarPath={member.User.avatarPath}
                      />
                      <span>{member.User.username}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'assignee': {
        const filteredMembers = members.filter((member) =>
          member.User.username.toLowerCase().includes(memberSearchInput.toLowerCase())
        );

        return (
          <div className="filter-dropdown-secondary">
            <div style={{ padding: 8 }}>
              <input
                type="text"
                value={memberSearchInput}
                onChange={(e) => setMemberSearchInput(e.target.value)}
                placeholder="Search assignees..."
                autoFocus
                className="filter-tag-search-input"
              />
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {filteredMembers.length === 0 ? (
                  <div style={{ padding: '8px 12px', opacity: 0.6, fontSize: 14 }}>
                    No members found
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <button
                      key={member.User.id}
                      onClick={() => {
                        addChip('assignee', `Assignee|${member.User.username}`, member.User.id as number);
                        setMemberSearchInput('');
                      }}
                      className="filter-dropdown-button-flex"
                    >
                      <UserAvatar
                        size={24}
                        username={member.User.username}
                        avatarPath={member.User.avatarPath}
                      />
                      <span>{member.User.username}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Overlay to close dropdowns */}
      {(isMainDropdownOpen || activeFilterType) && (
        <div
          className="filter-overlay"
          onClick={() => {
            setIsMainDropdownOpen(false);
            setActiveFilterType(null);
            setIncompleteChip(null);
            setTagSearchInput('');
            setMemberSearchInput('');
          }}
        />
      )}

      <div
        className="filter-input-container"
        onClick={() => {
          inputRef.current?.focus();
          setIsMainDropdownOpen(true);
        }}
      >
        {/* Chips container */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {chips.map((chip) => {
            const parts = chip.label.split('|');
            const hasDelimiter = parts.length === 2;
            const isTextSearch = chip.type === 'text';

            return (
              <div
                key={chip.id}
                onClick={(e) => handleChipClick(chip, e)}
                className={`filter-chip ${chip.type !== 'text' ? 'filter-chip-clickable' : 'filter-chip-non-clickable'}`}
              >
                {isTextSearch ? (
                  <>
                    <span style={{ padding: '0 4px 0 6px', display: 'flex', alignItems: 'center' }}>
                      <Search size={12} />
                    </span>
                    <span style={{ padding: '0 8px 0 2px' }}>
                      {chip.label}
                    </span>
                  </>
                ) : hasDelimiter ? (
                  <>
                    <span style={{ padding: '0 8px', fontWeight: 500 }}>
                      {parts[0]}
                    </span>
                    <div className="filter-chip-divider" />
                    <span style={{ padding: '0 8px' }}>
                      {parts[1]}
                    </span>
                  </>
                ) : (
                  <span style={{ padding: '0 8px' }}>
                    {chip.label}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChip(chip.id);
                  }}
                  className="filter-chip-remove-btn"
                  aria-label="Remove filter"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}

          {/* Incomplete chip when filter type is selected but value is not yet chosen */}
          {incompleteChip && (
            <div className="filter-chip">
              <span style={{ padding: '0 8px', fontWeight: 500 }}>
                {incompleteChip === 'priority' && 'Priority'}
                {incompleteChip === 'type' && 'Type'}
                {incompleteChip === 'status' && 'Status'}
                {incompleteChip === 'tag' && 'Tag'}
                {incompleteChip === 'author' && 'Author'}
                {incompleteChip === 'assignee' && 'Assignee'}
              </span>
              <div className="filter-chip-divider" />
              <span style={{ padding: '0 8px', opacity: 0.5 }}>
                ...
              </span>
            </div>
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsMainDropdownOpen(true)}
          placeholder={chips.length === 0 && !incompleteChip ? placeholder : ''}
          className="filter-main-input"
        />

        {/* Clear button */}
        {chips.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearAllFilters();
            }}
            className="filter-clear-btn"
            aria-label="Clear all filters"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Main dropdown for filter type selection */}
      {renderMainDropdown()}

      {/* Secondary dropdown for value selection */}
      {renderSecondaryDropdown()}
    </div>
  );
}
