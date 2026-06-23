import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, X, AlertTriangle, Trash2 } from 'lucide-react';
import { fromZonedTime } from 'date-fns-tz';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { useSpaces } from '@/hooks/useSpaces';
import { useTimezone } from '@/hooks/useTimezone';
import { useToast } from '@/context/ToastContext';
import type { CalendarEvent } from '@/types/app';

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
  onUpdate?: (eventId: string, updates: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    spaceId: string | null;
  }) => Promise<{ error: string | null }>;
  onDelete?: (eventId: string) => Promise<void>;
  eventToEdit?: CalendarEvent | null;
  defaultDate?: Date;
}

export function EventModal({ open, onClose, onSave, onUpdate, onDelete, eventToEdit, defaultDate: defaultDateProp }: EventModalProps) {
  const { spaces } = useSpaces();
  const { tz, nowInTz } = useTimezone();
  const toast = useToast();

  const defaultStart = defaultDateProp
    ? new Date(defaultDateProp.getFullYear(), defaultDateProp.getMonth(), defaultDateProp.getDate(), 9, 0)
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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!eventToEdit;

  const initialRef = useRef({ title: '', description: '', startStr: '', endStr: '', isAllDay: false, spaceId: 'personal' });
  const userEditedEnd = useRef(false);

  const addOneHour = (dtStr: string) => {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    d.setHours(d.getHours() + 1);
    return toLocalInput(d);
  };

  const handleStartChange = (value: string) => {
    setStartStr(value);
    if (!userEditedEnd.current && !isAllDay) {
      setEndStr(addOneHour(value));
    }
  };

  const handleEndChange = (value: string) => {
    userEditedEnd.current = true;
    setEndStr(value);
  };

  useEffect(() => {
    if (!open) return;
    setShowDiscardConfirm(false);
    setShowDeleteConfirm(false);
    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description);
      setIsAllDay(eventToEdit.is_all_day);
      setSpaceId(eventToEdit.space_id ?? 'personal');
      const startLocal = new Date(eventToEdit.start_time);
      const endLocal = new Date(eventToEdit.end_time);
      const s = toLocalInput(startLocal);
      const e = toLocalInput(endLocal);
      setStartStr(s);
      setEndStr(e);
      initialRef.current = { title: eventToEdit.title, description: eventToEdit.description, startStr: s, endStr: e, isAllDay: eventToEdit.is_all_day, spaceId: eventToEdit.space_id ?? 'personal' };
      userEditedEnd.current = true;
    } else {
      setTitle('');
      setDescription('');
      setIsAllDay(false);
      setSpaceId('personal');
      const s = defaultDateProp
        ? new Date(defaultDateProp.getFullYear(), defaultDateProp.getMonth(), defaultDateProp.getDate(), 9, 0)
        : new Date(nowInTz().getFullYear(), nowInTz().getMonth(), nowInTz().getDate(), 9, 0);
      const e = new Date(s.getTime() + 3600000);
      const startVal = toLocalInput(s);
      const endVal = toLocalInput(e);
      setStartStr(startVal);
      setEndStr(endVal);
      initialRef.current = { title: '', description: '', startStr: startVal, endStr: endVal, isAllDay: false, spaceId: 'personal' };
      userEditedEnd.current = false;
    }
  }, [open, eventToEdit]);

  const isDirty = () => {
    const init = initialRef.current;
    return title !== init.title
      || description !== init.description
      || startStr !== init.startStr
      || endStr !== init.endStr
      || isAllDay !== init.isAllDay
      || spaceId !== init.spaceId;
  };

  const handleRequestClose = () => {
    if (isDirty()) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

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
    if (endLocal < startLocal) {
      toast.warning('End time cannot be before start time');
      setSaving(false);
      return;
    }
    const startUTC = fromZonedTime(startLocal, tz).toISOString();
    const endUTC = fromZonedTime(endLocal, tz).toISOString();
    const eventData = {
      title: title.trim(),
      description: description.trim(),
      startTime: startUTC,
      endTime: endUTC,
      isAllDay,
      spaceId: spaceId === 'personal' ? null : spaceId,
    };
    const result = isEditing && onUpdate
      ? await onUpdate(eventToEdit.id, eventData)
      : await onSave(eventData);
    setSaving(false);
    if (!result.error) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!eventToEdit || !onDelete) return;
    setDeleting(true);
    await onDelete(eventToEdit.id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    onClose();
  };

  const spaceOptions = [
    { value: 'personal', label: 'Personal' },
    ...spaces.map((s) => ({ value: s.id, label: s.name || s.type.replace('_', ' ') })),
  ];

  if (showDiscardConfirm) {
    return (
      <Modal open={open} onClose={() => setShowDiscardConfirm(false)} title="Unsaved Changes">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-950/30 border border-amber-900/30">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-300">
              <p className="font-medium text-amber-300 mb-1">You have unsaved changes</p>
              <p className="text-zinc-400">Are you sure you want to discard them?</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowDiscardConfirm(false)}>
              Keep Editing
            </Button>
            <Button variant="danger" onClick={handleDiscard}>
              <X className="w-4 h-4" />
              Discard Changes
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (showDeleteConfirm) {
    return (
      <Modal open={open} onClose={() => setShowDeleteConfirm(false)} title="Delete Event">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-950/30 border border-red-900/30">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-300">
              <p className="font-medium text-red-300 mb-1">Delete &ldquo;{title}&rdquo;?</p>
              <p className="text-zinc-400">This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              <Trash2 className="w-4 h-4" />
              Delete Event
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleRequestClose} title={isEditing ? 'Edit Event' : 'Add Event'}>
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
            <Input label="Start" type="datetime-local" value={startStr} onChange={(e) => handleStartChange(e.target.value)} />
            <Input label="End" type="datetime-local" value={endStr} onChange={(e) => handleEndChange(e.target.value)} />
          </div>
        )}
        {isAllDay && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={startStr.slice(0, 10)} onChange={(e) => handleStartChange(e.target.value + 'T00:00')} />
            <Input label="End Date" type="date" value={endStr.slice(0, 10)} onChange={(e) => handleEndChange(e.target.value + 'T23:59')} />
          </div>
        )}
        <Select label="Space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} options={spaceOptions} />
        <div className="text-xs text-zinc-500">
          Times are in your local timezone ({tz.replace(/_/g, ' ')}).
        </div>
        <div className="flex justify-between gap-2">
          <div>
            {isEditing && onDelete && (
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleRequestClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isEditing ? 'Save Changes' : 'Add Event'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
