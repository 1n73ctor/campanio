'use client';

import { useId, useRef, useState } from 'react';
import { POPULAR_CITIES, cityBySlug, searchCities, type City } from '@companio/types';
import { Input, cn } from '@companio/ui';

type Props = {
  value: string;
  onChange: (slug: string) => void;
  /** Adds a first option that clears the city, e.g. "Any city". */
  anyLabel?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
};

/** Searchable city combobox: popular cities up front, type to find any of the rest (by city or state). */
export function CityPicker({ value, onChange, anyLabel, placeholder = 'Search city…', required, className, ...aria }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = value ? cityBySlug(value) : undefined;
  const results = query.trim() ? searchCities(query) : POPULAR_CITIES;
  // null stands for the "any city" option
  const options: (City | null)[] = anyLabel && !query.trim() ? [null, ...results] : results;

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (c: City | null) => {
    onChange(c?.slug ?? '');
    close();
    inputRef.current?.blur();
  };

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options.length ? `${listId}-${active}` : undefined}
        aria-label={aria['aria-label']}
        autoComplete="off"
        required={required}
        placeholder={selected ? selected.name : anyLabel ?? placeholder}
        value={open ? query : selected ? `📍 ${selected.name}` : ''}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) return setOpen(true);
            const d = e.key === 'ArrowDown' ? 1 : -1;
            setActive((i) => (i + d + options.length) % Math.max(options.length, 1));
          } else if (e.key === 'Enter' && open && options.length) {
            e.preventDefault(); // pick the city instead of submitting the surrounding form
            pick(options[active]);
          } else if (e.key === 'Escape') {
            close();
          }
        }}
        className="pr-3"
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-1.5 min-w-[15rem] max-h-80 overflow-y-auto rounded-chunky border-3 border-ink bg-white py-1.5 shadow-brutal">
          {!query.trim() && <li className="px-3.5 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wide text-ink-mute">Popular cities</li>}
          {options.map((c, i) => (
            <li
              key={c?.slug ?? '_any'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={(c?.slug ?? '') === value}
              onMouseDown={(e) => e.preventDefault()} // keep focus so the click lands before blur closes the list
              onClick={(e) => {
                e.preventDefault(); // stop an enclosing <label> from re-focusing the input and reopening the list
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2 text-[15px]', i === active && 'bg-paper-deep', (c?.slug ?? '') === value && 'font-bold')}
            >
              <span>{c ? `📍 ${c.name}` : anyLabel}</span>
              {c && <span className="text-xs text-ink-mute">{c.state}</span>}
            </li>
          ))}
          {query.trim() && !options.length && <li className="px-3.5 py-2 text-sm text-ink-mute">No city found — try a nearby bigger city</li>}
          {!query.trim() && <li className="px-3.5 pb-1 pt-2 text-xs text-ink-mute">Type to search more cities</li>}
        </ul>
      )}
    </div>
  );
}
