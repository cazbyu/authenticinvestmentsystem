// components/goals/ActionEffortModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Switch } from 'react-native';
import { Plus, X } from 'lucide-react-native';

type WeekOption = { week_number: number; start_date: string; end_date: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  // Goal context
  goal: {
    id: string;
    title: string;
    default_role_ids?: string[];
    default_domain_ids?: string[];
    user_cycle_id: string;
    user_cycle_week_start_day?: 'sunday' | 'monday';
  } | null;
  // Provided by the screen via useGoalProgress
  cycleWeeks: WeekOption[];
  // Save functions (we wire these in §3)
  createOrUpdateParentTask: (input: {
    goal_id: string;
    title: string;
    notes?: string;
    add_role_ids?: string[];      // additional roles (goal defaults are implicit & locked)
    add_domain_ids?: string[];    // additional domains
  }) => Promise<{ task_id: string }>;

  upsertWeekPlans: (input: {
    task_id: string;
    user_cycle_id: string;
    week_numbers: number[];
    target_days: number;          // 0..7
  }) => Promise<void>;
};

const FREQ_CHOICES = [
  { key: 'daily', label: 'Daily', days: 7 },
  { key: '6', label: '6 days a week', days: 6 },
  { key: '5', label: '5 days a week', days: 5 },
  { key: '4', label: '4 days a week', days: 4 },
  { key: '3', label: '3 days a week', days: 3 },
  { key: '2', label: 'Twice a week', days: 2 },
  { key: '1', label: 'Once a week', days: 1 },
  { key: 'custom', label: 'Custom weekdays', days: -1 },
] as const;

export default function ActionEffortModal({
  visible, onClose, goal, cycleWeeks, createOrUpdateParentTask, upsertWeekPlans,
}: Props) {
  const [title, setTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Weeks selection
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  // Frequency
  const [freqKey, setFreqKey] = useState<typeof FREQ_CHOICES[number]['key']>('daily');
  const [customDays, setCustomDays] = useState<{ su: boolean; mo: boolean; tu: boolean; we: boolean; th: boolean; fr: boolean; sa: boolean; }>({
    su: true, mo: true, tu: true, we: true, th: true, fr: true, sa: true,
  });

  // Additional roles/domains (goal’s defaults are implicit & locked)
  const [addRoleIds, setAddRoleIds] = useState<string[]>([]);
  const [addDomainIds, setAddDomainIds] = useState<string[]>([]);

  // Preselect current week on open
  useEffect(() => {
    if (!visible || !cycleWeeks?.length) return;
    // Pick the week that contains "today"
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const wk = cycleWeeks.find(w => todayStr >= w.start_date && todayStr <= w.end_date);
    setSelectedWeeks(wk ? [wk.week_number] : [cycleWeeks[0].week_number]);
    setFreqKey('daily');
  }, [visible, cycleWeeks?.[0]?.start_date]);

  // Compute target days
  const targetDays = useMemo(() => {
    if (freqKey === 'custom') {
      return ['su','mo','tu','we','th','fr','sa'].filter(k => (customDays as any)[k]).length;
    }
    const entry = FREQ_CHOICES.find(f => f.key === freqKey)!;
    return entry.days;
  }, [freqKey, customDays]);

  if (!goal) return null;

  const toggleWeek = (n: number) => {
    setSelectedWeeks(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a,b)=>a-b));
  };

  const allSelected = selectedWeeks.length === cycleWeeks.length;
  const selectAll = () => setSelectedWeeks(cycleWeeks.map(w => w.week_number));
  const clearAll = () => setSelectedWeeks([]);

  const save = async () => {
    if (!title.trim() || selectedWeeks.length === 0) {
      // minimal inline validation
      return;
    }

    const { task_id } = await createOrUpdateParentTask({
      goal_id: goal.id,
      title: title.trim(),
      notes: notes?.trim() || undefined,
      add_role_ids: addRoleIds,
      add_domain_ids: addDomainIds,
    });

    await upsertWeekPlans({
      task_id,
      user_cycle_id: goal.user_cycle_id,
      week_numbers: selectedWeeks,
      target_days: targetDays,
    });

    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '90%' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, fontWeight: '600' }}>Add Action Effort</Text>
            <TouchableOpacity onPress={onClose}><X size={18} /></TouchableOpacity>
          </View>

          <ScrollView style={{ marginTop: 12 }}>
            {/* Title */}
            <Text style={{ fontWeight: '600', marginBottom: 4 }}>Title</Text>
            <TextInput
              placeholder="e.g., Do 100 push-ups"
              value={title}
              onChangeText={setTitle}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 12 }}
            />

            {/* Weeks */}
            <Text style={{ fontWeight: '600', marginBottom: 4 }}>Weeks</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              <TouchableOpacity onPress={allSelected ? clearAll : selectAll} style={{ paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 999, marginRight: 8, marginBottom: 8 }}>
                <Text>{allSelected ? 'Clear All' : 'Select All'}</Text>
              </TouchableOpacity>
              {cycleWeeks.map(w => (
                <TouchableOpacity
                  key={w.week_number}
                  onPress={() => toggleWeek(w.week_number)}
                  style={{
                    paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1,
                    borderColor: selectedWeeks.includes(w.week_number) ? '#111' : '#ddd',
                    backgroundColor: selectedWeeks.includes(w.week_number) ? '#111' : 'white',
                    borderRadius: 999, marginRight: 8, marginBottom: 8,
                  }}
                >
                  <Text style={{ color: selectedWeeks.includes(w.week_number) ? 'white' : '#111' }}>
                    {`Week ${w.week_number}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Frequency */}
            <Text style={{ fontWeight: '600', marginBottom: 4 }}>Frequency per week</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
              {FREQ_CHOICES.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setFreqKey(opt.key)}
                  style={{
                    paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1,
                    borderColor: freqKey === opt.key ? '#111' : '#ddd',
                    backgroundColor: freqKey === opt.key ? '#111' : 'white',
                    borderRadius: 999, marginRight: 8, marginBottom: 8,
                  }}
                >
                  <Text style={{ color: freqKey === opt.key ? 'white' : '#111' }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom weekdays */}
            {freqKey === 'custom' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ marginBottom: 6 }}>Pick days (counts toward target)</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {(['su','mo','tu','we','th','fr','sa'] as const).map(k => (
                    <TouchableOpacity
                      key={k}
                      onPress={() => setCustomDays(prev => ({ ...prev, [k]: !prev[k] }))}
                      style={{
                        width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: customDays[k] ? '#111' : '#ddd', backgroundColor: customDays[k] ? '#111' : 'white'
                      }}
                    >
                      <Text style={{ color: customDays[k] ? 'white' : '#111' }}>{k.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Notes */}
            <Text style={{ fontWeight: '600', marginBottom: 4 }}>Notes (optional)</Text>
            <TextInput
              placeholder="Add details if useful"
              value={notes}
              onChangeText={setNotes}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 12 }}
              multiline
            />

            {/* Roles/Domains – inherited are locked, user can add more */}
            <Text style={{ fontWeight: '600', marginBottom: 4 }}>Roles (goal defaults locked)</Text>
            <Text style={{ color: '#666', marginBottom: 6 }}>
              Inherited: {(goal.default_role_ids || []).length || 0}. You can add more below.
            </Text>
            {/* Replace these two TextInputs with your actual role/domain pickers used in TaskEventForm */}
            <TextInput placeholder="Add role ids comma-separated" value={addRoleIds.join(',')} onChangeText={(t)=>setAddRoleIds(t.split(',').map(x=>x.trim()).filter(Boolean))} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 12 }} />
            <Text style={{ fontWeight: '600', marginBottom: 4 }}>Domains (goal defaults locked)</Text>
            <Text style={{ color: '#666', marginBottom: 6 }}>
              Inherited: {(goal.default_domain_ids || []).length || 0}. You can add more below.
            </Text>
            <TextInput placeholder="Add domain ids comma-separated" value={addDomainIds.join(',')} onChangeText={(t)=>setAddDomainIds(t.split(',').map(x=>x.trim()).filter(Boolean))} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 12 }} />

            {/* Save */}
            <TouchableOpacity onPress={save} style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Save plan</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
