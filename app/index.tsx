// app/index.tsx (temporary smoke test)
import React from 'react';
import { View, Text } from 'react-native';

export default function Index() {
  console.log('HOME: rendering'); // 👈 sentinel
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>It mounts ✔️</Text>
    </View>
  );
}
