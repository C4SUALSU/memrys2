import { useState } from 'react';
import { Plus, Calendar, Clock, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useSpaces } from '@/hooks/useSpaces';
import { useTimezone } from '@/hooks/useTimezone';
import { useToast } from '@/context/ToastContext';

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (event: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    spaceId: string | null;
  }) => Promise<{ error: string | null }>;
  defaultDate?: Date;
}

export function EventModal({ open, onClose, onSave, defaultDate }: EventModalProps) {
  const { spaces } = useSpaces();
  const { tz, nowInTz } = useTimezone();
  const toast = useToast();

  const defaultStart = defaultDate
    ? new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate(), 9, 0)
    : new Date(nowInTz().getFullYear(), nowInTz().getMonth(), nowInTz().getDate(), 9, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 3600000);

  const toLocalInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startStr, setStartStr] = useState(toLocalInput(defaultStart));
  const [endStr, setEndStr] = useState(toLocalInput(defaultEnd));
  const [isAllDay, setIsAllDay] = useState(false);
  const [spaceId, setSpaceId] = useState<string>('personal');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.warning('Please enter an event title');
      return;
    }
    setSaving(true);
    const startLocal = new Date(startStr);
    const endLocal = new Date(endStr);
    if (isNaN(startLocal.getTime()) || isNaN(endLocal.getTime())) {
      toast.warning('Invalid date/time');
      setSaving(false);
      return;
    }
    const startUTC = startLocal.toISOString();
    const endUTC = endLocal.toISOString();
    const result = await onSave({
      title: title.trim(),
      description: description.trim(),
      startTime: startUTC,
      endTime: endUTC,
      isAllDay,
      spaceId: spaceId === 'personal' ? null : spaceId,
    });
    setSaving(false);
    if (!result.error) {
      setTitle('');
      setDescription('');
      onClose();
    }
  };

  const spaceOptions = [
    { value: 'personal', label: 'Personal' },
    ...spaces.map((s) => ({ value: s.id, label: s.name || s.type.replace('_', ' ') })),
  ];

  return (
    <Modal open={open} onClose={onClose} title="Add Event">
      <div className="flex flex-col gap-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event name"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        />
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details..."
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-900 text-brand-100 focus:ring-brand-500"
            />
            <span className="text-sm text-zinc-300">All day</span>
          </label>
        </div>
        {!isAllDay && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start" type="datetime-local" value={startStr} onChange={(e) => setStartStr(e.target.value)} />
            <Input label="End" type="datetime-local" value={endStr} onChange={(e) => setEndStr(e.target.value)} />
          </div>
        )}
        {isAllDay && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={startStr.slice(0, 10)} onChange={(e) => setStartStr(e.target.value + 'T00:00')} />
            <Input label="End Date" type="date" value={endStr.slice(0, 10)} onChange={(e) => setEndStr(e.target.value + 'T23:59')} />
          </div>
        )}
        <Select label="Space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} options={spaceOptions} />
        <div className="text-xs text-zinc-500">
          Times are in your local timezone ({tz.replace(/_/g, ' ')}).
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
        </div>
      </div>
    </Modal>
  );
}
