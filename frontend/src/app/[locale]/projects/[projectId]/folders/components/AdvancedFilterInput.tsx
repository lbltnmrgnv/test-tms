'use client';
import { useState, useEffect, useContext, useRef } from 'react';
import { Circle, X, Search } from 'lucide-react';
import { FilterOptions, FilterChip, FilterType } from '@/types/filter';
import { priorities, testTypes } from '@/config/selection';
import { fetchTags } from '@/utils/tagsControls';
import { TokenContext } from '@/utils/TokenProvider';
import { PriorityMessages } from '@/types/priority';
import { TestTypeMessages } from '@/types/testType';
import { TagType } from '@/types/tag';

type Tag = Pick<TagType, 'id' | 'name'>;

interface Props {
  projectId: string;
  value: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  priorityMessages?: PriorityMessages;
  testTypeMessages?: TestTypeMessages;
  placeholder?: string;
}

export default function AdvancedFilterInput({
                                              projectId,
                                              value,
                                              onChange,
                                              priorityMessages,
                                              testTypeMessages,
                                              placeholder = 'Search or add filter...',
                                            }: Props) {
  const context = useContext(TokenContext);
  const [chips, setChips] = useState<FilterChip[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isMainDropdownOpen, setIsMainDropdownOpen] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState<FilterType | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [editingChipId, setEditingChipId] = useState<string | null>(null);
  const [incompleteChip, setIncompleteChip] = useState<FilterType | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Загрузка тегов
  useEffect(() => {
    const loadTags = async () => {
      const tagsData = await fetchTags(context.token.access_token, projectId);
      setTags(tagsData || []);
    };
    loadTags();
  }, [projectId, context.token.access_token]);

  // Обработка нажатия клавиш
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      addChip('text', inputValue.trim(), inputValue.trim());
      setInputValue('');
    }
    if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      removeChip(chips[chips.length - 1].id);
    }
  };

  // Добавление чипа
  const addChip = (type: FilterType, label: string, value: string | number) => {
    // Если редактируем существующий chip - удаляем его
    let baseChips = chips;
    if (editingChipId) {
      baseChips = chips.filter((c) => c.id !== editingChipId);
      setEditingChipId(null);
    }

    // Убираем incomplete chip
    setIncompleteChip(null);

    // Для text - заменяем предыдущий
    if (type === 'text') {
      const newChips = baseChips.filter((c) => c.type !== 'text');
      const newChip = { id: `text-${Date.now()}`, type, label, value };
      const updatedChips = [...newChips, newChip];
      setChips(updatedChips);
      setActiveFilterType(null);
      applyFiltersFromChips(updatedChips);
      return;
    }

    // Проверка дублей для priority, type, tag
    const isDuplicate = baseChips.some((c) => c.type === type && c.value === value);
    if (isDuplicate) {
      setActiveFilterType(null);
      return;
    }

    const newChip = { id: `${type}-${value}-${Date.now()}`, type, label, value };
    const updatedChips = [...baseChips, newChip];
    setChips(updatedChips);
    setActiveFilterType(null);

    // Автоприменение
    applyFiltersFromChips(updatedChips);
  };

  // Удаление чипа
  const removeChip = (chipId: string) => {
    const newChips = chips.filter((c) => c.id !== chipId);
    setChips(newChips);
    applyFiltersFromChips(newChips);
  };

  // Применение фильтров из чипов
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

    onChange(filters);
  };

  // Очистка всех фильтров
  const clearAllFilters = () => {
    setChips([]);
    setInputValue('');
    onChange({});
  };

  // Обработчик изменения input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    // Закрываем dropdown при вводе текста
    if (e.target.value) {
      setIsMainDropdownOpen(false);
    }
  };

  // Обработчик клика на chip для изменения значения
  const handleChipClick = (chip: FilterChip, e: React.MouseEvent) => {
    e.stopPropagation();
    if (chip.type !== 'text') {
      setEditingChipId(chip.id);
      setActiveFilterType(chip.type);
    }
  };

  // Рендер главного dropdown с типами фильтров
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
          onClick={() => handleFilterTypeClick('tag')}
          className="filter-dropdown-button"
        >
          Tags
        </button>
      </div>
    );
  };

  // Рендер вторичного dropdown для выбора значений
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

      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Overlay для закрытия dropdown'ов */}
      {(isMainDropdownOpen || activeFilterType) && (
        <div
          className="filter-overlay"
          onClick={() => {
            setIsMainDropdownOpen(false);
            setActiveFilterType(null);
            setIncompleteChip(null);
            setTagSearchInput('');
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
                {incompleteChip === 'tag' && 'Tag'}
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

      {/* Main dropdown для выбора типа фильтра */}
      {renderMainDropdown()}

      {/* Secondary dropdown для выбора значений */}
      {renderSecondaryDropdown()}
    </div>
  );
}
