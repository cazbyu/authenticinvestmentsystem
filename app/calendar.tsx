import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Header } from '@/components/Header';

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const onDayPress = (day: any) => {
    setSelectedDate(day.dateString);
  };

  const markedDates = {
    [selectedDate]: {
      selected: true,
      selectedColor: '#0078d4',
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Calendar View" />
      
      <ScrollView style={styles.content}>
        <Calendar
          onDayPress={onDayPress}
          markedDates={markedDates}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: '#0078d4',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#0078d4',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#00adf5',
            selectedDotColor: '#ffffff',
            arrowColor: '#0078d4',
            disabledArrowColor: '#d9e1e8',
            monthTextColor: '#0078d4',
            indicatorColor: '#0078d4',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 13
          }}
        />
        
        <View style={styles.selectedDateContainer}>
          <Text style={styles.selectedDateLabel}>Selected Date:</Text>
          <Text style={styles.selectedDateText}>{selectedDate}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  selectedDateContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  selectedDateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  selectedDateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0078d4',
  },
});