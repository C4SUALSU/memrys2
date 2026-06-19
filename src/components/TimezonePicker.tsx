import { useState } from 'react';
import { Search, Globe } from 'lucide-react';
import { Select } from './ui/Select';
import { IANA_TIMEZONES } from '@/lib/constants';

interface TimezonePickerProps {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
}

export function TimezonePicker({ value, onChange, disabled }: TimezonePickerProps) {
  const [search, setSearch] = useState('');

  const filteredZones = search
    ? IANA_TIMEZONES.filter((tz) => tz.toLowerCase().includes(search.toLowerCase()))
    : IANA_TIMEZONES;

  const options = filteredZones.slice(0, 200).map((tz) => ({
    value: tz,
    label: tz.replace(/_/g, ' '),
  }));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search timezone..."
          className="input-field pl-9 text-sm"
          disabled={disabled}
        />
      </div>
      <Select
        options={options}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Globe className="w-3 h-3" />
        <span>Current: {value.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );
}
