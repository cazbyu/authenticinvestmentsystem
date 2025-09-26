// TaskEventForm.tsx — Unified (v5 base UI + v5.1 goal logic + ActionEffortModal recurrence)
// Drop-in replacement. Keep your Dashboard import path: `import TaskEventForm from '@/components/tasks/TaskEventForm'`

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSupabaseClient } from "@/lib/supabase";
import {
  X,
  Repeat as RepeatIcon,
  Calendar as CalendarIcon,
  Clock,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react-native";
import { formatLocalDate, parseLocalDate } from "@/lib/dateUtils";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

interface TaskEventFormProps {
  mode: "create" | "edit";
  initialData?: Partial<any>;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

interface Role {
  id: string;
  label: string;
  color?: string;
}
interface Domain {
  id: string;
  name: string;
}
interface KeyRelationship {
  id: string;
  name: string;
  role_id: string;
}

type UnifiedGoal = {
  id: string;
  title: string;
  goal_type: "twelve_wk_goal" | "custom_goal";
};

// Minimal Task model shape used here; actual DB row may contain more fields
type TaskType = "task" | "event" | "depositIdea" | "withdrawal";

// ───────────────────────────────────────────────────────────────────────────────
// Local utils (time & recurrence)
// ───────────────────────────────────────────────────────────────────────────────

const toDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDefaultTime = (addHours: number = 1) => {
  const now = new Date();
  now.setHours(now.getHours() + addHours);
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(minutes, 0, 0);
  const hour24 = now.getHours();
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 < 12 ? "am" : "pm";
  return `${hour12}:${String(now.getMinutes()).padStart(2, "0")} ${ampm}`;
};

const combineDateAndTime = (date: Date, time: string) => {
  // time: "h:mm am/pm"
  const [timePart, period] = time.split(" ");
  let [h, m] = timePart.split(":").map(Number);
  if (period === "pm" && h < 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  const combined = new Date(date);
  combined.setHours(h, m, 0, 0);
  return combined.toISOString();
};

// ── Recurrence from ActionEffortModal (simple RFC5545 RRULE):
// repeatEvery (number, in weeks), repeatOn (['MO','WE',...]), endDate (date string)
const buildRecurrenceRule = (args: {
  repeatEvery?: number;
  repeatOn?: string[]; // BYDAY tokens
  endDate?: string | null; // 'YYYY-MM-DD'
}) => {
  const { repeatEvery = 1, repeatOn = [], endDate } = args || {};
  const parts: string[] = ["FREQ=WEEKLY"];
  if (repeatEvery && repeatEvery > 1) parts.push(`INTERVAL=${repeatEvery}`);
  if (repeatOn.length) parts.push(`BYDAY=${repeatOn.join(",")}`);
  if (endDate) {
    // UNTIL in YYYYMMDD
    const d = endDate.replace(/-/g, "");
    parts.push(`UNTIL=${d}`);
  }
  return `RRULE:${parts.join(";")}`;
};

// ───────────────────────────────────────────────────────────────────────────────
// Calendar Day (visual only, same look/feel as your v5 base UI)
// ───────────────────────────────────────────────────────────────────────────────

const CustomDay: React.FC<any> = ({ date, state, marking, onPress }) => {
  const isSelected = marking?.selected;
  const isToday = state === "today";
  return (
    <TouchableOpacity
      onPress={() => onPress(date)}
      style={[styles.dayContainer, isSelected && styles.selectedDay]}
    >
      <Text
        style={[
          styles.dayText,
          isToday && !isSelected && styles.todayText,
          isSelected && styles.selectedDayText,
          state === "disabled" && styles.disabledDayText,
        ]}
      >
        {date.day}
      </Text>
    </TouchableOpacity>
  );
};

// ───────────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────────

const TaskEventForm: React.FC<TaskEventFormProps> = ({
  mode,
  initialData,
  onSubmitSuccess,
  onClose,
}) => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const dateInputRef = useRef<TouchableOpacity>(null);
  const startTimeInputRef = useRef<TouchableOpacity>(null);
  const endTimeInputRef = useRef<TouchableOpacity>(null);
  const endDateInputRef = useRef<TouchableOpacity>(null);

  // ── Core Form State (kept in v5 style)
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    type: TaskType;
    dueDate: string; // YYYY-MM-DD
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    isAnytime: boolean;
    isUrgent: boolean;
    isImportant: boolean;
    isAuthenticDeposit: boolean;
    // goal selection (new)
    selectedGoalId: string | null;
    selectedGoalType: "twelve_wk_goal" | "custom_goal" | null;
    // metadata joins
    selectedRoleIds: string[];
    selectedDomainIds: string[];
    selectedKeyRelationshipIds: string[];
    // recurrence (simple weekly builder)
    repeatEvery: number; // weeks
    repeatOn: string[]; // ['MO','WE']
    recurrenceEndDate: string | null; // YYYY-MM-DD
    // finance-only
    amount?: string;
    withdrawalDate?: string;
    // timeline (if known in context, keep for FK pass-through)
    user_global_timeline_id?: string | null;
    user_custom_timeline_id?: string | null;
  }>({
    title: "",
    description: "",
    type: "task",
    dueDate: formatLocalDate(new Date()),
    startDate: formatLocalDate(new Date()),
    endDate: formatLocalDate(new Date()),
    startTime: "",
    endTime: "",
    isAllDay: false,
    isAnytime: false,
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    selectedGoalId: null,
    selectedGoalType: null,
    selectedRoleIds: [],
    selectedDomainIds: [],
    selectedKeyRelationshipIds: [],
    repeatEvery: 1,
    repeatOn: [],
    recurrenceEndDate: null,
    amount: "",
    withdrawalDate: formatLocalDate(new Date()),
    user_global_timeline_id: null,
    user_custom_timeline_id: null,
  });

  // ── UI State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // calendars
  const [showDueDateCal, setShowDueDateCal] = useState(false);
  const [showStartDateCal, setShowStartDateCal] = useState(false);
  const [showEndDateCal, setShowEndDateCal] = useState(false);
  const [showRecurrenceEndCal, setShowRecurrenceEndCal] = useState(false);

  // Recurrence dropdown
  const [recurrenceExpanded, setRecurrenceExpanded] = useState(false);

  // Roles/Domains/KRs (v5 style)
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>(
    []
  );

  // Goals (new unified)
  const [allAvailableGoals, setAllAvailableGoals] = useState<UnifiedGoal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<UnifiedGoal | null>(null);
  const [goalDropdownOpen, setGoalDropdownOpen] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // Data loading
  // ───────────────────────────────────────────────────────────────────────────

  const fetchRolesDomainsKRs = async (userId: string) => {
    const [rolesRes, domainsRes, krRes] = await Promise.all([
      supabase.from("0008-ap-roles").select("id,label,color").eq("user_id", userId),
      supabase.from("0008-ap-domains").select("id,name").eq("user_id", userId),
      supabase
        .from("0008-ap-key-relationships")
        .select("id,name,role_id")
        .eq("user_id", userId),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (domainsRes.error) throw domainsRes.error;
    if (krRes.error) throw krRes.error;
    setRoles(rolesRes.data || []);
    setDomains(domainsRes.data || []);
    setKeyRelationships(krRes.data || []);
  };

  const fetchAllGoals = async (userId: string) => {
    const [g12, gCustom] = await Promise.all([
      supabase
        .from("0008-ap-goals-12wk")
        .select("id,title")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("title"),
      supabase
        .from("0008-ap-goals-custom")
        .select("id,title")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("title"),
    ]);
    if (g12.error) throw g12.error;
    if (gCustom.error) throw gCustom.error;
    const unified: UnifiedGoal[] = [
      ...(g12.data || []).map((g) => ({
        id: g.id,
        title: g.title,
        goal_type: "twelve_wk_goal" as const,
      })),
      ...(gCustom.data || []).map((g) => ({
        id: g.id,
        title: g.title,
        goal_type: "custom_goal" as const,
      })),
    ];
    setAllAvailableGoals(unified);
    // Backfill selection in edit mode if needed
    if (formData.selectedGoalId && !selectedGoal) {
      const g = unified.find((x) => x.id === formData.selectedGoalId);
      if (g) {
        setSelectedGoal(g);
        setFormData((p) => ({ ...p, selectedGoalType: g.goal_type }));
      }
    }
  };

  const loadInitialData = async () => {
    if (!initialData) return;

    // Safely map initialData to our form model
    setFormData((prev) => ({
      ...prev,
      title: String(initialData.title ?? prev.title),
      description: String(initialData.description ?? prev.description),
      type: (initialData.type as TaskType) ?? prev.type,
      dueDate:
        initialData.due_date ??
        initialData.dueDate ??
        prev.dueDate ??
        formatLocalDate(new Date()),
      startDate:
        initialData.start_date ??
        initialData.startDate ??
        prev.startDate ??
        formatLocalDate(new Date()),
      endDate:
        initialData.end_date ??
        initialData.endDate ??
        prev.endDate ??
        formatLocalDate(new Date()),
      startTime: initialData.start_time
        ? timeISOTo12h(initialData.start_time)
        : prev.startTime,
      endTime: initialData.end_time
        ? timeISOTo12h(initialData.end_time)
        : prev.endTime,
      isAllDay: Boolean(initialData.is_all_day ?? prev.isAllDay),
      isAnytime: Boolean(initialData.is_anytime ?? prev.isAnytime),
      isUrgent: Boolean(initialData.is_urgent ?? prev.isUrgent),
      isImportant: Boolean(initialData.is_important ?? prev.isImportant),
      isAuthenticDeposit: Boolean(
        initialData.is_authentic_deposit ?? prev.isAuthenticDeposit
      ),
      // Goal backfill if edit
      selectedGoalId:
        initialData.twelve_wk_goal_id ??
        initialData.custom_goal_id ??
        prev.selectedGoalId,
      selectedGoalType:
        initialData.twelve_wk_goal_id
          ? "twelve_wk_goal"
          : initialData.custom_goal_id
          ? "custom_goal"
          : prev.selectedGoalType,
      // Timeline FK pass-through if present on edit
      user_global_timeline_id:
        initialData.user_global_timeline_id ?? prev.user_global_timeline_id,
      user_custom_timeline_id:
        initialData.user_custom_timeline_id ?? prev.user_custom_timeline_id,
      // Simple recurrence backfill from RRULE (if present)
      ...rruleToSimpleState(initialData.recurrence_rule, prev),
    }));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await Promise.all([fetchRolesDomainsKRs(user.id), fetchAllGoals(user.id)]);
        if (initialData) await loadInitialData();
      } catch (e: any) {
        console.error(e);
        Alert.alert("Error", e.message || "Failed to load form data.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers (time, rrule)
  // ───────────────────────────────────────────────────────────────────────────

  const timeISOTo12h = (iso?: string) => {
    if (!iso) return getDefaultTime();
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h < 12 ? "am" : "pm";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  function rruleToSimpleState(
    rrule: string | undefined,
    prev: any
  ): Partial<typeof formData> {
    if (!rrule || typeof rrule !== "string" || !rrule.startsWith("RRULE:"))
      return {};
    // Parse minimally: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20251231
    const body = rrule.replace("RRULE:", "");
    const kv = Object.fromEntries(
      body.split(";").map((part) => {
        const [k, v] = part.split("=");
        return [k, v];
      })
    );
    const repeatEvery = kv.INTERVAL ? Number(kv.INTERVAL) || 1 : 1;
    const repeatOn = kv.BYDAY ? kv.BYDAY.split(",") : [];
    const recurrenceEndDate = kv.UNTIL
      ? `${kv.UNTIL.slice(0, 4)}-${kv.UNTIL.slice(4, 6)}-${kv.UNTIL.slice(
          6,
          8
        )}`
      : null;
    return {
      repeatEvery,
      repeatOn,
      recurrenceEndDate,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Goal handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleGoalSelect = (g: UnifiedGoal) => {
    setSelectedGoal(g);
    setFormData((p) => ({
      ...p,
      selectedGoalId: g.id,
      selectedGoalType: g.goal_type,
    }));
    setGoalDropdownOpen(false);
  };

  const handleGoalClear = () => {
    setSelectedGoal(null);
    setFormData((p) => ({
      ...p,
      selectedGoalId: null,
      selectedGoalType: null,
    }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Submit
  // ───────────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // Build main payload for tasks/events (deposit/withdraw handled below)
      const isTaskOrEvent = formData.type === "task" || formData.type === "event";

      if (isTaskOrEvent) {
        // Build times
        const dueDateISO = parseLocalDate(formData.dueDate).toISOString();
        const startDateISO = parseLocalDate(formData.startDate).toISOString();
        const endDateISO = parseLocalDate(formData.endDate).toISOString();

        const start_time =
          !formData.isAllDay && formData.startTime
            ? combineDateAndTime(parseLocalDate(formData.startDate), formData.startTime)
            : null;
        const end_time =
          !formData.isAllDay && formData.endTime
            ? combineDateAndTime(parseLocalDate(formData.endDate), formData.endTime)
            : null;

        // Recurrence (ActionEffortModal style)
        const recurrence_rule =
          formData.repeatEvery > 0 || (formData.repeatOn?.length ?? 0) > 0
            ? buildRecurrenceRule({
                repeatEvery: formData.repeatEvery || 1,
                repeatOn: formData.repeatOn || [],
                endDate: formData.recurrenceEndDate || null,
              })
            : null;

        // Build base payload
        const payload: any = {
          title: formData.title.trim(),
          description: (formData.description || "").trim(),
          type: formData.type, // 'task' | 'event'
          user_id: user.id,
          due_date: dueDateISO,
          start_date: startDateISO,
          end_date: endDateISO,
          start_time,
          end_time,
          is_all_day: formData.isAllDay,
          is_anytime: formData.isAnytime,
          is_urgent: formData.isUrgent,
          is_important: formData.isImportant,
          is_authentic_deposit: formData.isAuthenticDeposit,
          status: "active",
          recurrence_rule,
          // timeline FK pass-through if present
          user_global_timeline_id: formData.user_global_timeline_id || null,
          user_custom_timeline_id: formData.user_custom_timeline_id || null,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        // Inject goal FK if selected
        if (formData.selectedGoalId && formData.selectedGoalType) {
          if (formData.selectedGoalType === "twelve_wk_goal") {
            payload.twelve_wk_goal_id = formData.selectedGoalId;
          } else if (formData.selectedGoalType === "custom_goal") {
            payload.custom_goal_id = formData.selectedGoalId;
          }
        }

        // Insert or update
        let taskId: string | null = null;

        if (mode === "edit" && initialData?.id) {
          const { error: upErr } = await supabase
            .from("0008-ap-tasks")
            .update(payload)
            .eq("id", initialData.id);
          if (upErr) throw upErr;
          taskId = String(initialData.id);
        } else {
          const { data, error: insErr } = await supabase
            .from("0008-ap-tasks")
            .insert(payload)
            .select("id")
            .single();
          if (insErr) throw insErr;
          taskId = data?.id ?? null;
        }

        if (!taskId) throw new Error("Task not created.");

        // Notes handling (simple: if description provided as a note, optional)
        // If you maintain separate Notes UI, keep that flow; here we just support optional join.
        // Example: if you want to persist a separate note row on create:
        // (commented by default to avoid duping description into notes)
/*
        if (formData.description?.trim()) {
          const { data: note, error: noteErr } = await supabase
            .from("0008-ap-notes")
            .insert({
              content: formData.description.trim(),
              user_id: user.id,
              source_type: "task",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (noteErr) throw noteErr;
          if (note?.id) {
            const { error: noteJoinErr } = await supabase
              .from("0008-ap-universal-notes-join")
              .insert({
                parent_id: taskId,
                parent_type: "task",
                note_id: note.id,
                user_id: user.id,
              });
            if (noteJoinErr) throw noteJoinErr;
          }
        }
*/

        // Clear + write joins (roles/domains/KRs/goals)
        if (mode === "edit") {
          const del = await Promise.all([
            supabase
              .from("0008-ap-universal-roles-join")
              .delete()
              .eq("parent_id", taskId)
              .eq("parent_type", "task"),
            supabase
              .from("0008-ap-universal-domains-join")
              .delete()
              .eq("parent_id", taskId)
              .eq("parent_type", "task"),
            supabase
              .from("0008-ap-universal-key-relationships-join")
              .delete()
              .eq("parent_id", taskId)
              .eq("parent_type", "task"),
            supabase
              .from("0008-ap-universal-goals-join")
              .delete()
              .eq("parent_id", taskId)
              .eq("parent_type", "task"),
          ]);
          for (const r of del) if ((r as any).error) throw (r as any).error;
        }

        const joinPromises: Promise<any>[] = [];

        if (formData.selectedRoleIds?.length) {
          const rows = formData.selectedRoleIds.map((role_id) => ({
            parent_id: taskId,
            parent_type: "task",
            role_id,
            user_id: user.id,
          }));
          joinPromises.push(
            supabase.from("0008-ap-universal-roles-join").insert(rows)
          );
        }

        if (formData.selectedDomainIds?.length) {
          const rows = formData.selectedDomainIds.map((domain_id) => ({
            parent_id: taskId,
            parent_type: "task",
            domain_id,
            user_id: user.id,
          }));
          joinPromises.push(
            supabase.from("0008-ap-universal-domains-join").insert(rows)
          );
        }

        if (formData.selectedKeyRelationshipIds?.length) {
          const rows = formData.selectedKeyRelationshipIds.map(
            (key_relationship_id) => ({
              parent_id: taskId,
              parent_type: "task",
              key_relationship_id,
              user_id: user.id,
            })
          );
          joinPromises.push(
            supabase
              .from("0008-ap-universal-key-relationships-join")
              .insert(rows)
          );
        }

        if (formData.selectedGoalId && formData.selectedGoalType) {
          joinPromises.push(
            supabase.from("0008-ap-universal-goals-join").insert({
              parent_id: taskId,
              parent_type: "task",
              goal_id: formData.selectedGoalId,
              goal_type: formData.selectedGoalType,
              user_id: user.id,
            })
          );
        }

        if (joinPromises.length) {
          const res = await Promise.all(joinPromises);
          for (const r of res) if ((r as any).error) throw (r as any).error;
        }

        Alert.alert("Success", mode === "edit" ? "Task updated" : "Task created");
        onSubmitSuccess();
        return;
      }

      // ── Deposit Ideas
      if (formData.type === "depositIdea") {
        const payload: any = {
          title: formData.title.trim(),
          description: (formData.description || "").trim(),
          user_id: (await supabase.auth.getUser()).data.user?.id,
          is_active: true,
          archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        let id: string | null = null;
        if (mode === "edit" && initialData?.id) {
          const { error } = await supabase
            .from("0008-ap-deposit-ideas")
            .update(payload)
            .eq("id", initialData.id);
          if (error) throw error;
          id = String(initialData.id);
        } else {
          const { data, error } = await supabase
            .from("0008-ap-deposit-ideas")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          id = data?.id ?? null;
        }

        if (!id) throw new Error("Deposit idea not created");

        // joins (roles/domains/KRs) optional for ideas; replicate pattern if you already had it

        Alert.alert(
          "Success",
          mode === "edit" ? "Idea updated" : "Idea created"
        );
        onSubmitSuccess();
        return;
      }

      // ── Withdrawals
      if (formData.type === "withdrawal") {
        const wdDateISO = parseLocalDate(
          formData.withdrawalDate || formatLocalDate(new Date())
        ).toISOString();
        const payload: any = {
          title: formData.title.trim(),
          description: (formData.description || "").trim(),
          amount: Number(formData.amount || 0),
          withdrawal_date: wdDateISO,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (mode === "edit" && initialData?.id) {
          const { error } = await supabase
            .from("0008-ap-withdrawals")
            .update(payload)
            .eq("id", initialData.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("0008-ap-withdrawals")
            .insert(payload);
          if (error) throw error;
        }

        Alert.alert(
          "Success",
          mode === "edit" ? "Withdrawal updated" : "Withdrawal created"
        );
        onSubmitSuccess();
        return;
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render helpers (minimal, v5-like look)
  // ───────────────────────────────────────────────────────────────────────────

  const renderGoalSelector = () => (
    <View style={styles.field}>
      <Text style={styles.label}>Link to Goal</Text>

      <TouchableOpacity
        style={styles.input}
        onPress={() => setGoalDropdownOpen((p) => !p)}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Target size={18} color="#111827" />
          <Text style={{ marginLeft: 8 }}>
            {selectedGoal
              ? `${selectedGoal.title} • ${
                  selectedGoal.goal_type === "twelve_wk_goal" ? "12-Week" : "Custom"
                }`
              : "Select a Goal"}
          </Text>
        </View>
        {goalDropdownOpen ? (
          <ChevronUp size={18} color="#6b7280" />
        ) : (
          <ChevronDown size={18} color="#6b7280" />
        )}
      </TouchableOpacity>

      {selectedGoal && (
        <TouchableOpacity
          onPress={handleGoalClear}
          style={{ marginTop: 6, alignSelf: "flex-start" }}
        >
          <Text style={{ textDecorationLine: "underline", color: "#1d4ed8" }}>
            Clear goal
          </Text>
        </TouchableOpacity>
      )}

      {goalDropdownOpen && (
        <View style={[styles.card, { marginTop: 8, paddingVertical: 6 }]}>
          {allAvailableGoals.length === 0 ? (
            <View style={{ padding: 10 }}>
              <Text style={{ color: "#6b7280" }}>No active goals found</Text>
            </View>
          ) : (
            <FlatList
              data={allAvailableGoals}
              keyExtractor={(g) => g.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleGoalSelect(item)}
                  style={{ paddingVertical: 10, paddingHorizontal: 12 }}
                >
                  <Text style={{ fontWeight: "600", color: "#111827" }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: "#6b7280" }}>
                    {item.goal_type === "twelve_wk_goal"
                      ? "12-Week Goal"
                      : "Custom Goal"}
                  </Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: "#e5e7eb" }} />
              )}
              style={{ maxHeight: 220 }}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      )}
    </View>
  );

  const renderRecurrence = () => (
    <View style={styles.field}>
      <TouchableOpacity
        style={[styles.rowBetween, styles.recurrenceButton]}
        onPress={() => setRecurrenceExpanded((p) => !p)}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <RepeatIcon size={18} color="#1d4ed8" />
          <Text style={[styles.recurrenceButtonText, { marginLeft: 8 }]}>
            Repeat
          </Text>
        </View>
        {recurrenceExpanded ? (
          <ChevronUp size={18} color="#1f2937" />
        ) : (
          <ChevronDown size={18} color="#1f2937" />
        )}
      </TouchableOpacity>

      {recurrenceExpanded && (
        <View style={{ marginTop: 10 }}>
          {/* Repeat every X weeks */}
          <View style={styles.row}>
            <Text style={[styles.label, { marginRight: 8 }]}>Every</Text>
            <TextInput
              style={[styles.input, { width: 64 }]}
              keyboardType="numeric"
              value={String(formData.repeatEvery || 1)}
              onChangeText={(t) =>
                setFormData((p) => ({
                  ...p,
                  repeatEvery: Math.max(1, Number(t || 1)),
                }))
              }
            />
            <Text style={[styles.label, { marginLeft: 8 }]}>week(s)</Text>
          </View>

          {/* Days of week */}
          <View style={[styles.weekdayRow, { marginTop: 10 }]}>
            {[
              { k: "MO", label: "Mon" },
              { k: "TU", label: "Tue" },
              { k: "WE", label: "Wed" },
              { k: "TH", label: "Thu" },
              { k: "FR", label: "Fri" },
              { k: "SA", label: "Sat" },
              { k: "SU", label: "Sun" },
            ].map((d) => {
              const active = formData.repeatOn.includes(d.k);
              return (
                <TouchableOpacity
                  key={d.k}
                  style={[
                    styles.weekdayChip,
                    active && styles.weekdayChipSelected,
                  ]}
                  onPress={() =>
                    setFormData((p) => ({
                      ...p,
                      repeatOn: active
                        ? p.repeatOn.filter((x) => x !== d.k)
                        : [...p.repeatOn, d.k],
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.weekdayText,
                      active && styles.weekdayTextSelected,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Until (end date) */}
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>End by (optional)</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowRecurrenceEndCal(true)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CalendarIcon size={18} color="#111827" />
                <Text style={{ marginLeft: 8 }}>
                  {formData.recurrenceEndDate
                    ? formData.recurrenceEndDate
                    : "No end date"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.center, { padding: 24 }]}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.rowBetween, { padding: 12 }]}>
        <Text style={styles.headerTitle}>
          {mode === "edit" ? "Edit" : "Create"}{" "}
          {formData.type === "event"
            ? "Event"
            : formData.type === "depositIdea"
            ? "Deposit Idea"
            : formData.type === "withdrawal"
            ? "Withdrawal"
            : "Task"}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
          <X size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(t) => setFormData((p) => ({ ...p, title: t }))}
            placeholder="What will you do?"
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            multiline
            value={formData.description}
            onChangeText={(t) => setFormData((p) => ({ ...p, description: t }))}
            placeholder="Optional context"
          />
        </View>

        {/* Dates & Times (kept simple; mirrors v5 look) */}
        <View style={styles.row}>
          <View style={[styles.col, { flex: 1 }]}>
            <Text style={styles.label}>Start</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowStartDateCal(true)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CalendarIcon size={18} color="#111827" />
                <Text style={{ marginLeft: 8 }}>{formData.startDate}</Text>
              </View>
            </TouchableOpacity>
            {!formData.isAllDay && (
              <TouchableOpacity
                style={[styles.input, { marginTop: 8 }]}
                onPress={() =>
                  (startTimeInputRef.current as any)?.focus?.() ||
                  setFormData((p) => ({
                    ...p,
                    startTime: p.startTime || getDefaultTime(),
                  }))
                }
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Clock size={18} color="#111827" />
                  <Text style={{ marginLeft: 8 }}>
                    {formData.startTime || "Set start time"}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.col, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Due</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDueDateCal(true)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CalendarIcon size={18} color="#111827" />
                <Text style={{ marginLeft: 8 }}>{formData.dueDate}</Text>
              </View>
            </TouchableOpacity>
            {!formData.isAllDay && (
              <TouchableOpacity
                style={[styles.input, { marginTop: 8 }]}
                onPress={() =>
                  (endTimeInputRef.current as any)?.focus?.() ||
                  setFormData((p) => ({
                    ...p,
                    endTime: p.endTime || getDefaultTime(2),
                  }))
                }
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Clock size={18} color="#111827" />
                  <Text style={{ marginLeft: 8 }}>
                    {formData.endTime || "Set end time"}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* All day / Anytime */}
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <View style={styles.row}>
            <Text style={styles.switchLabel}>All day</Text>
            <Switch
              value={formData.isAllDay}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, isAllDay: v }))
              }
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.switchLabel}>Anytime</Text>
            <Switch
              value={formData.isAnytime}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, isAnytime: v }))
              }
            />
          </View>
        </View>

        {/* Urgent / Important / Authentic Deposit */}
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <View style={styles.row}>
            <Text style={styles.switchLabel}>Urgent</Text>
            <Switch
              value={formData.isUrgent}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, isUrgent: v }))
              }
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.switchLabel}>Important</Text>
            <Switch
              value={formData.isImportant}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, isImportant: v }))
              }
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.switchLabel}>Authentic Deposit</Text>
            <Switch
              value={formData.isAuthenticDeposit}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, isAuthenticDeposit: v }))
              }
            />
          </View>
        </View>

        {/* Goal selector (new, minimal UI) */}
        {renderGoalSelector()}

        {/* Recurrence (ActionEffortModal style) */}
        {renderRecurrence()}

        {/* Roles / Domains / Key Relationships (checkbox-like pills) */}
        {!!roles.length && (
          <View style={styles.field}>
            <Text style={styles.label}>Roles</Text>
            <View style={styles.pillWrap}>
              {roles.map((r) => {
                const active = formData.selectedRoleIds.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() =>
                      setFormData((p) => ({
                        ...p,
                        selectedRoleIds: active
                          ? p.selectedRoleIds.filter((x) => x !== r.id)
                          : [...p.selectedRoleIds, r.id],
                      }))
                    }
                    style={[
                      styles.pill,
                      active && styles.pillActive,
                      r.color ? { borderColor: r.color } : null,
                    ]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {!!domains.length && (
          <View style={styles.field}>
            <Text style={styles.label}>Domains</Text>
            <View style={styles.pillWrap}>
              {domains.map((d) => {
                const active = formData.selectedDomainIds.includes(d.id);
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() =>
                      setFormData((p) => ({
                        ...p,
                        selectedDomainIds: active
                          ? p.selectedDomainIds.filter((x) => x !== d.id)
                          : [...p.selectedDomainIds, d.id],
                      }))
                    }
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {!!keyRelationships.length && (
          <View style={styles.field}>
            <Text style={styles.label}>Key Relationships</Text>
            <View style={styles.pillWrap}>
              {keyRelationships.map((k) => {
                const active = formData.selectedKeyRelationshipIds.includes(k.id);
                return (
                  <TouchableOpacity
                    key={k.id}
                    onPress={() =>
                      setFormData((p) => ({
                        ...p,
                        selectedKeyRelationshipIds: active
                          ? p.selectedKeyRelationshipIds.filter((x) => x !== k.id)
                          : [...p.selectedKeyRelationshipIds, k.id],
                      }))
                    }
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {k.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.primaryBtnText}>
            {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Create"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Calendars */}
      <Modal visible={showStartDateCal} transparent animationType="fade">
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Calendar
              onDayPress={(day: any) => {
                setFormData((p) => ({ ...p, startDate: day.dateString }));
                setShowStartDateCal(false);
              }}
              dayComponent={(props) => <CustomDay {...props} />}
              markedDates={{ [formData.startDate]: { selected: true } }}
            />
            <TouchableOpacity
              style={[styles.dialogButton, styles.dialogCancel]}
              onPress={() => setShowStartDateCal(false)}
            >
              <Text style={styles.dialogCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDueDateCal} transparent animationType="fade">
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Calendar
              onDayPress={(day: any) => {
                setFormData((p) => ({ ...p, dueDate: day.dateString }));
                setShowDueDateCal(false);
              }}
              dayComponent={(props) => <CustomDay {...props} />}
              markedDates={{ [formData.dueDate]: { selected: true } }}
            />
            <TouchableOpacity
              style={[styles.dialogButton, styles.dialogCancel]}
              onPress={() => setShowDueDateCal(false)}
            >
              <Text style={styles.dialogCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEndDateCal} transparent animationType="fade">
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Calendar
              onDayPress={(day: any) => {
                setFormData((p) => ({ ...p, endDate: day.dateString }));
                setShowEndDateCal(false);
              }}
              dayComponent={(props) => <CustomDay {...props} />}
              markedDates={{ [formData.endDate]: { selected: true } }}
            />
            <TouchableOpacity
              style={[styles.dialogButton, styles.dialogCancel]}
              onPress={() => setShowEndDateCal(false)}
            >
              <Text style={styles.dialogCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRecurrenceEndCal} transparent animationType="fade">
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Calendar
              onDayPress={(day: any) => {
                setFormData((p) => ({ ...p, recurrenceEndDate: day.dateString }));
                setShowRecurrenceEndCal(false);
              }}
              dayComponent={(props) => <CustomDay {...props} />}
              markedDates={
                formData.recurrenceEndDate
                  ? { [formData.recurrenceEndDate]: { selected: true } }
                  : {}
              }
            />
            <TouchableOpacity
              style={[styles.dialogButton, styles.dialogCancel]}
              onPress={() => setShowRecurrenceEndCal(false)}
            >
              <Text style={styles.dialogCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ───────────────────────────────────────────────────────────────────────────────
// Styles (kept minimal & consistent with your v5 approach)
// ───────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  field: { marginTop: 12 },
  label: { color: "#374151", marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", alignItems: "center" },
  col: { flexDirection: "column" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: { backgroundColor: "#e0f2fe", borderColor: "#93c5fd" },
  pillText: { color: "#111827" },
  pillTextActive: { color: "#1d4ed8", fontWeight: "600" },

  // Calendar day styles
  dayContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectedDay: { backgroundColor: "#e0f2fe" },
  dayText: { color: "#111827" },
  todayText: { fontWeight: "700" },
  selectedDayText: { color: "#1d4ed8", fontWeight: "700" },
  disabledDayText: { color: "#9ca3af" },

  // Recurrence
  recurrenceButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  recurrenceButtonText: { color: "#1d4ed8", fontWeight: "600" },

  // Dialog buttons
  dialogButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  dialogCancel: { backgroundColor: "#f3f4f6" },
  dialogCancelText: { color: "#111827" },

  // Primary save
  primaryBtn: {
    marginTop: 16,
    backgroundColor: "#1d4ed8",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  weekdayRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weekdayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  weekdayChipSelected: { backgroundColor: "#e0f2fe", borderColor: "#93c5fd" },
  weekdayText: { color: "#111827" },
  weekdayTextSelected: { color: "#1d4ed8", fontWeight: "600" },
});

export default TaskEventForm;
