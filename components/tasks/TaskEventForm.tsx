import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  StyleSheet,
  LayoutRectangle,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import {
  X,
  Repeat,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react-native';

type SchedulingType = 'task' | 'event' | 'depositIdea' | 'withdrawal';

type Props = {
  initial?: Partial<{
    title: string;
    notes: string;
    schedulingType: SchedulingType;
    dueDate: Date;
    startTime?: string; // "HH:mm"
    endTime?: string;   // "HH:mm"
    isAnytime?: boolean;
    eventEndDate?: Date;
    recurrenceRule?: string; // RRULE:...
  }>;
  onCancel?: () => void;
  onSubmit?: (payload: any) => void;
};

// --- Utilities --------------------------------------------------------------

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const formatDateForInput = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const timeOptions = (() => {
  // 30-min steps
  const list: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      list.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return list;
})();

const getDurationLabel = (start?: string, end?: string) => {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return ` (${h}h ${m}m)`;
  if (h) return ` (${h}h)`;
  if (m) return ` (${m}m)`;
  return '';
};

const combineDateAndTime = (date: Date, time?: string) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out;
};

// --- Component --------------------------------------------------------------

export default function TaskEventForm({ initial, onCancel, onSubmit }: Props) {
  // Base form state
  const [schedulingType, setSchedulingType] = useState<SchedulingType>(initial?.schedulingType ?? 'task');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [dueDate, setDueDate] = useState<Date>(initial?.dueDate ?? new Date());
  const [isAnytime, setIsAnytime] = useState<boolean>(!!initial?.isAnytime);
  const [startTime, setStartTime] = useState<string | undefined>(initial?.startTime);
  const [endTime, setEndTime] = useState<string | undefined>(initial?.endTime);

  // Event-only extensions
  const [eventEndDate, setEventEndDate] = useState<Date>(initial?.eventEndDate ?? initial?.dueDate ?? new Date());

  // Recurrence state (events only)
  const [isRepeating, setIsRepeating] = useState<boolean>(!!initial?.recurrenceRule);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Yearly'>('Weekly');
  const [selectedRecurrenceDays, setSelectedRecurrenceDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [isRecurrenceModalVisible, setIsRecurrenceModalVisible] = useState(false);

  // Anchored mini-calendar popover (for compact date pickers)
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState<LayoutRectangle>({ x: 0, y: 0, width: 280, height: 40 } as any);
  const [activeCalendarField, setActiveCalendarField] = useState<'start' | 'end'>('start');

  // Compact time list modal
  const [showTimePicker, setShowTimePicker] = useState<null | 'start' | 'end'>(null);

  // Anchors
  const dateInputRef = useRef<TouchableOpacity>(null);
  const endDateInputRef = useRef<TouchableOpacity>(null);
  const startTimeInputRef = useRef<TouchableOpacity>(null);
  const endTimeInputRef = useRef<TouchableOpacity>(null);

  // Mirror inputs for display
  const [dateInputValue, setDateInputValue] = useState(formatDateForInput(dueDate));
  const [endDateInputValue, setEndDateInputValue] = useState(formatDateForInput(eventEndDate));

  useEffect(() => {
    // keep inputs in sync on mount
    setDateInputValue(formatDateForInput(dueDate));
    setEndDateInputValue(formatDateForInput(eventEndDate));
  }, []);

  // Handlers ---------------------------------------------------------------

  const onCalendarDayPress = (day: any) => {
    // avoid timezone drift by constructing in local
    const selected = new Date(day.year, day.month - 1, day.day);
    if (activeCalendarField === 'end') {
      setEventEndDate(selected);
      setEndDateInputValue(formatDateForInput(selected));
    } else {
      setDueDate(selected);
      setDateInputValue(formatDateForInput(selected));
      // if end < start, sync it
      if (eventEndDate < selected) {
        setEventEndDate(selected);
        setEndDateInputValue(formatDateForInput(selected));
      }
    }
    setShowMiniCalendar(false);
  };

  const handleDateInputChange = (text: string) => {
    setDateInputValue(text);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      const local = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      setDueDate(local);
    }
  };

  const handleEndDateInputChange = (text: string) => {
    setEndDateInputValue(text);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      const local = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      setEventEndDate(local);
    }
  };

  // Recurrence helpers (kept in this component scope!)
  const getRecurrenceDisplayText = () => {
    if (!isRepeating) return 'Does not repeat';
    let text = recurrenceFrequency;
    if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length > 0) {
      const map: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
      text += ` on ${selectedRecurrenceDays.map(d => map[d] || d).join(', ')}`;
    }
    if (recurrenceEndDate) {
      text += ` until ${recurrenceEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return text;
  };

  const constructRecurrenceRule = (): string => {
    const parts: string[] = [];
    let freq = recurrenceFrequency;
    let interval = 1;
    if (freq === 'Bi-weekly') { freq = 'Weekly'; interval = 2; }
    parts.push(`FREQ=${freq.toUpperCase()}`);
    if (interval !== 1) parts.push(`INTERVAL=${interval}`);
    if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length > 0) {
      parts.push(`BYDAY=${selectedRecurrenceDays.join(',')}`);
    }
    if (recurrenceEndDate) {
      const y = recurrenceEndDate.getFullYear();
      const m = String(recurrenceEndDate.getMonth() + 1).padStart(2, '0');
      const d = String(recurrenceEndDate.getDate()).padStart(2, '0');
      parts.push(`UNTIL=${y}${m}${d}`);
    }
    return `RRULE:${parts.join(';')}`;
  };

  // Submit -----------------------------------------------------------------

  const handleSubmit = () => {
    const payload: any = {
      title,
      notes,
      schedulingType,
      due_date: toDateString(dueDate),
      is_anytime: isAnytime,
    };

    if (schedulingType === 'event' && !isAnytime) {
      payload.start_time = startTime ?? null;
      payload.end_time = endTime ?? null;
    } else if (schedulingType === 'task') {
      // keep "complete by" semantics via start_time if you want
      payload.start_time = isAnytime ? null : (startTime ?? null);
      payload.end_time = null;
    } else {
      payload.start_time = null;
      payload.end_time = null;
    }

    if (schedulingType === 'event') {
      payload.start_date = toDateString(dueDate);
      payload.end_date = toDateString(eventEndDate || dueDate);
      payload.recurrence_rule = isRepeating ? constructRecurrenceRule() : null;
    }

    onSubmit?.(payload);
  };

  // Render helpers ----------------------------------------------------------

  const renderSchedulingToggle = () => (
    <View style={styles.segmentRow}>
      {(['task', 'event', 'depositIdea', 'withdrawal'] as SchedulingType[]).map((key) => (
        <TouchableOpacity
          key={key}
          onPress={() => setSchedulingType(key)}
          style={[styles.segmentButton, schedulingType === key && styles.segmentButtonActive]}
        >
          <Text style={[styles.segmentText, schedulingType === key && styles.segmentTextActive]}>
            {key === 'depositIdea' ? 'Deposit Idea' : key[0].toUpperCase() + key.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDateRowEvent = () => (
    <View>
      <View style={styles.row}>
        {/* Start Date */}
        <TouchableOpacity
          ref={dateInputRef}
          style={styles.compactDateButton}
          onPress={() => {
            dateInputRef.current?.measure((fx, fy, w, h, px, py) => {
              setDatePickerPosition({ x: px, y: py + h, width: w, height: h } as any);
              setActiveCalendarField('start');
              setShowMiniCalendar(true);
            });
          }}
        >
          <Text style={styles.compactInputLabel}>Date</Text>
          <TextInput
            style={styles.dateTextInput}
            value={dateInputValue}
            onChangeText={handleDateInputChange}
            editable={false}
          />
        </TouchableOpacity>

        {/* End Date */}
        <TouchableOpacity
          ref={endDateInputRef}
          style={styles.compactDateButton}
          onPress={() => {
            endDateInputRef.current?.measure((fx, fy, w, h, px, py) => {
              setDatePickerPosition({ x: px, y: py + h, width: w, height: h } as any);
              setActiveCalendarField('end');
              setShowMiniCalendar(true);
            });
          }}
        >
          <Text style={styles.compactInputLabel}>End Date</Text>
          <TextInput
            style={styles.dateTextInput}
            value={endDateInputValue}
            onChangeText={handleEndDateInputChange}
            editable={false}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        {/* Start Time */}
        <TouchableOpacity
          ref={startTimeInputRef}
          style={[styles.compactDateButton, { flex: 1 }]}
          disabled={isAnytime}
          onPress={() => {
            if (isAnytime) return;
            startTimeInputRef.current?.measure((fx, fy, w, h, px, py) => {
              setDatePickerPosition({ x: px, y: py + h, width: w, height: h } as any);
              setShowTimePicker('start');
            });
          }}
        >
          <Text style={styles.compactInputLabel}>Start</Text>
          <View style={styles.inline}>
            <Clock size={16} />
            <Text style={styles.timeTextInput}>{startTime ?? '—'}</Text>
          </View>
        </TouchableOpacity>

        {/* End Time */}
        <TouchableOpacity
          ref={endTimeInputRef}
          style={[styles.compactDateButton, { flex: 1 }]}
          disabled={isAnytime}
          onPress={() => {
            if (isAnytime) return;
            endTimeInputRef.current?.measure((fx, fy, w, h, px, py) => {
              setDatePickerPosition({ x: px, y: py + h, width: w, height: h } as any);
              setShowTimePicker('end');
            });
          }}
        >
          <Text style={styles.compactInputLabel}>
            End{getDurationLabel(startTime, endTime)}
          </Text>
          <View style={styles.inline}>
            <Clock size={16} />
            <Text style={styles.timeTextInput}>{endTime ?? '—'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Anytime toggle */}
      <View style={[styles.row, { justifyContent: 'space-between', marginTop: 8 }]}>
        <Text style={styles.compactSectionTitle}>Anytime</Text>
        <Switch
          value={isAnytime}
          onValueChange={(v) => {
            setIsAnytime(v);
            if (v) { setStartTime(undefined); setEndTime(undefined); }
          }}
        />
      </View>

      {/* Repeat (Recurrence) */}
      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.compactSectionTitle}>Repeat</Text>
          <Switch
            value={isRepeating}
            onValueChange={(value) => {
              setIsRepeating(value);
              if (value) setIsRecurrenceModalVisible(true);
              if (!value) { setSelectedRecurrenceDays([]); setRecurrenceEndDate(null); setRecurrenceFrequency('Weekly'); }
            }}
          />
        </View>
        {isRepeating && (
          <TouchableOpacity
            style={styles.recurrenceButton}
            onPress={() => setIsRecurrenceModalVisible(true)}
          >
            <Text style={styles.recurrenceButtonText}>
              {getRecurrenceDisplayText()}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderDateRowTask = () => (
    <View>
      <View style={styles.row}>
        {/* Due Date */}
        <TouchableOpacity
          ref={dateInputRef}
          style={styles.compactDateButton}
          onPress={() => {
            dateInputRef.current?.measure((fx, fy, w, h, px, py) => {
              setDatePickerPosition({ x: px, y: py + h, width: w, height: h } as any);
              setActiveCalendarField('start');
              setShowMiniCalendar(true);
            });
          }}
        >
          <Text style={styles.compactInputLabel}>Due Date</Text>
          <TextInput
            style={styles.dateTextInput}
            value={dateInputValue}
            onChangeText={handleDateInputChange}
            editable={false}
          />
        </TouchableOpacity>

        {/* Complete by (optional) */}
        <TouchableOpacity
          ref={startTimeInputRef}
          style={[styles.compactDateButton, { flex: 1 }]}
          disabled={isAnytime}
          onPress={() => {
            if (isAnytime) return;
            startTimeInputRef.current?.measure((fx, fy, w, h, px, py) => {
              setDatePickerPosition({ x: px, y: py + h, width: w, height: h } as any);
              setShowTimePicker('start');
            });
          }}
        >
          <Text style={styles.compactInputLabel}>Complete by</Text>
          <View style={styles.inline}>
            <Clock size={16} />
            <Text style={styles.timeTextInput}>{startTime ?? '—'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.row, { justifyContent: 'space-between', marginTop: 8 }]}>
        <Text style={styles.compactSectionTitle}>Anytime</Text>
        <Switch
          value={isAnytime}
          onValueChange={(v) => {
            setIsAnytime(v);
            if (v) { setStartTime(undefined); }
          }}
        />
      </View>
    </View>
  );

  // JSX ---------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.header}>Task / Event Form</Text>

        {renderSchedulingToggle()}

        {/* Title */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Name"
            style={styles.input}
          />
        </View>

        {/* Notes */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Details"
            style={[styles.input, { height: 80 }]}
            multiline
          />
        </View>

        {/* Scheduling */}
        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          {schedulingType === 'event' ? renderDateRowEvent() :
           schedulingType === 'task' ? renderDateRowTask() :
           <Text style={{ color: '#6b7280', marginTop: 8 }}>
             {schedulingType === 'depositIdea'
               ? 'No scheduling is required for Deposit Ideas.'
               : 'No scheduling is required for Withdrawals.'}
           </Text>}
        </View>

        {/* Actions */}
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
            <Text style={styles.btnGhostText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleSubmit}>
            <Text style={styles.btnPrimaryText}>Save</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mini Calendar Popover (anchored) */}
      <Modal visible={!!showMiniCalendar} transparent animationType="fade" onRequestClose={() => setShowMiniCalendar(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowMiniCalendar(false)}>
          <View
            style={[
              styles.popover,
              { top: datePickerPosition.y, left: datePickerPosition.x, width: 300 },
            ]}
          >
            <View style={styles.popoverHeader}>
              <Text style={styles.popoverTitle}>Pick a date</Text>
              <TouchableOpacity onPress={() => setShowMiniCalendar(false)}>
                <X size={18} color="#111827" />
              </TouchableOpacity>
            </View>

            <Calendar
              onDayPress={onCalendarDayPress}
              markedDates={{
                [toDateString(
                  activeCalendarField === 'end' ? (eventEndDate || dueDate) : dueDate
                )]: { selected: true }
              }}
              hideExtraDays
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Pop-up Time Picker Modal */}
      <Modal visible={!!showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowTimePicker(null)}>
          <View
            style={[
              styles.popover,
              { top: datePickerPosition.y, left: datePickerPosition.x, width: 220, maxHeight: 360 },
            ]}
          >
            <View style={styles.popoverHeader}>
              <Text style={styles.popoverTitle}>
                {showTimePicker === 'start' ? 'Start time' : 'End time'}
              </Text>
              <TouchableOpacity onPress={() => setShowTimePicker(null)}>
                <X size={18} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
              {timeOptions.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={styles.timeRow}
                  onPress={() => {
                    if (showTimePicker === 'start') {
                      setStartTime(t);
                      // auto-suggest end time 30m later if empty
                      if (!endTime) {
                        const idx = timeOptions.indexOf(t);
                        const next = timeOptions[(idx + 1) % timeOptions.length];
                        setEndTime(next);
                      }
                    } else {
                      setEndTime(t);
                    }
                    setShowTimePicker(null);
                  }}
                >
                  <Text style={styles.timeText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Recurrence Settings Modal */}
      <RecurrenceSettingsModal
        visible={isRecurrenceModalVisible}
        onClose={() => setIsRecurrenceModalVisible(false)}
        onSave={({ frequency, selectedDays, endDate }) => {
          setRecurrenceFrequency(frequency as any);
          setSelectedRecurrenceDays(selectedDays);
          setRecurrenceEndDate(endDate);
          setIsRecurrenceModalVisible(false);
          setIsRepeating(true);
        }}
        initialSettings={{
          frequency: recurrenceFrequency,
          selectedDays: selectedRecurrenceDays,
          endDate: recurrenceEndDate,
        }}
      />
    </View>
  );
}

// --- Recurrence Modal (self-contained; no parent helpers referenced) ------

interface RecurrenceSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: { frequency: string; selectedDays: string[]; endDate: Date | null }) => void;
  initialSettings: { frequency: string; selectedDays: string[]; endDate: Date | null };
}

const weekdayOptions = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const frequencyOptions = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];

function RecurrenceSettingsModal({
  visible,
  onClose,
  onSave,
  initialSettings,
}: RecurrenceSettingsModalProps) {
  const [frequency, setFrequency] = useState<string>(initialSettings.frequency || 'Weekly');
  const [selectedDays, setSelectedDays] = useState<string[]>(initialSettings.selectedDays || []);
  const [until, setUntil] = useState<Date | null>(initialSettings.endDate || null);

  useEffect(() => {
    setFrequency(initialSettings.frequency || 'Weekly');
    setSelectedDays(initialSettings.selectedDays || []);
    setUntil(initialSettings.endDate || null);
  }, [initialSettings, visible]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.recurrenceContainer}>
        <View style={styles.recurrenceHeader}>
          <Text style={styles.recurrenceTitle}>Recurrence Settings</Text>
          <TouchableOpacity onPress={onClose}><X size={22} color="#111827" /></TouchableOpacity>
        </View>

        <ScrollView style={styles.recurrenceContent}>
          <Text style={styles.recurrenceLabel}>Frequency</Text>
          <View style={styles.frequencyGrid}>
            {frequencyOptions.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFrequency(f)}
                style={[styles.frequencyButton, frequency === f && styles.frequencyButtonSelected]}
              >
                <Text style={[styles.frequencyButtonText, frequency === f && styles.frequencyButtonTextSelected]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {(frequency === 'Weekly' || frequency === 'Bi-weekly') && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.recurrenceLabel}>Repeat On</Text>
              <View style={styles.weekdayRow}>
                {weekdayOptions.map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => toggleDay(d)}
                    style={[styles.weekdayChip, selectedDays.includes(d) && styles.weekdayChipSelected]}
                  >
                    <Text style={[styles.weekdayText, selectedDays.includes(d) && styles.weekdayTextSelected]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <Text style={styles.recurrenceLabel}>Ends</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setUntil(null)}
                style={[styles.endChoice, until === null && styles.endChoiceSelected]}
              >
                <Text style={[styles.endChoiceText, until === null && styles.endChoiceTextSelected]}>Never</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setUntil(until ?? new Date())}
                style={[styles.endChoice, until !== null && styles.endChoiceSelected]}
              >
                <Text style={[styles.endChoiceText, until !== null && styles.endChoiceTextSelected]}>
                  {until ? formatDateForInput(until) : 'On date...'}
                </Text>
              </TouchableOpacity>
            </View>
            {until !== null && (
              <View style={{ marginTop: 8 }}>
                <Calendar
                  onDayPress={(day: any) => {
                    const d = new Date(day.year, day.month - 1, day.day);
                    setUntil(d);
                  }}
                  markedDates={until ? { [toISO(until)]: { selected: true } } : {}}
                />
              </View>
            )}
          </View>
        </ScrollView>

        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
          <TouchableOpacity style={[styles.dialogButton, styles.dialogCancel]} onPress={onClose}><Text style={styles.dialogCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity
            style={[styles.dialogButton, styles.dialogSave]}
            onPress={() => onSave({ frequency, selectedDays, endDate: until })}
          >
            <Text style={styles.dialogSaveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// --- Styles ----------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 18, fontWeight: '600', color: '#111827' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  label: { fontSize: 14, color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: '#111827',
  },

  segmentRow: {
    flexDirection: 'row', gap: 8, marginTop: 12,
  },
  segmentButton: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#d1d5db',
  },
  segmentButtonActive: {
    backgroundColor: '#e0f2fe', borderColor: '#93c5fd',
  },
  segmentText: { color: '#111827' },
  segmentTextActive: { color: '#1d4ed8', fontWeight: '600' },

  row: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 8 },
  inline: { flexDirection: 'row', gap: 6, alignItems: 'center' },

  compactDateButton: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  compactInputLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  dateTextInput: { color: '#111827' },
  timeTextInput: { color: '#111827' },

  compactSectionTitle: { fontSize: 14, color: '#111827', fontWeight: '500' },

  btn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  btnGhost: { backgroundColor: '#f3f4f6' },
  btnGhostText: { color: '#111827' },
  btnPrimary: { backgroundColor: '#1d4ed8' },
  btnPrimaryText: { color: 'white', fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  popover: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    paddingBottom: 8,
  },
  popoverHeader: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  popoverTitle: { fontWeight: '600', color: '#111827' },

  timeRow: {
    paddingVertical: 10, paddingHorizontal: 12,
  },
  timeText: { color: '#111827' },

  // Recurrence styles
  recurrenceContainer: { flex: 1, backgroundColor: '#fff' },
  recurrenceHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb'
  },
  recurrenceTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  recurrenceContent: { paddingHorizontal: 16, paddingTop: 12 },
  recurrenceLabel: { fontSize: 14, color: '#374151', marginBottom: 8 },
  frequencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frequencyButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  frequencyButtonSelected: { backgroundColor: '#e0f2fe', borderColor: '#93c5fd' },
  frequencyButtonText: { color: '#111827' },
  frequencyButtonTextSelected: { color: '#1d4ed8', fontWeight: '600' },
  weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekdayChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#d1d5db' },
  weekdayChipSelected: { backgroundColor: '#e0f2fe', borderColor: '#93c5fd' },
  weekdayText: { color: '#111827' },
  weekdayTextSelected: { color: '#1d4ed8', fontWeight: '600' },
  endChoice: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  endChoiceSelected: { backgroundColor: '#e0f2fe', borderColor: '#93c5fd' },
  endChoiceText: { color: '#111827' },
  endChoiceTextSelected: { color: '#1d4ed8', fontWeight: '600' },
  recurrenceButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  recurrenceButtonText: { color: '#1d4ed8', fontWeight: '500' },

  dialogButton: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  dialogCancel: { backgroundColor: '#f3f4f6' },
  dialogCancelText: { color: '#111827' },
  dialogSave: { backgroundColor: '#1d4ed8' },
  dialogSaveText: { color: 'white', fontWeight: '600' },
});
