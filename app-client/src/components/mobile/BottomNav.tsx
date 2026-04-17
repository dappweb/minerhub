import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type BottomTab = 'home' | 'earnings' | 'exchange' | 'device' | 'profile';

type BottomNavProps = {
  activeTab: BottomTab;
  tabs: Array<{ key: BottomTab; label: string }>;
  onChange: (tab: BottomTab) => void;
};

export default function BottomNav({ activeTab, tabs, onChange }: BottomNavProps) {
  return (
    <View style={styles.wrap}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.item, activeTab === tab.key && styles.itemActive]}
          onPress={() => onChange(tab.key)}
        >
          <Text style={[styles.label, activeTab === tab.key && styles.labelActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#123565',
    backgroundColor: '#05142f',
  },
  item: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0a2148',
  },
  itemActive: {
    backgroundColor: '#0b45a1',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  label: {
    color: '#8fc8ff',
    fontSize: 12,
    fontWeight: '700',
  },
  labelActive: {
    color: '#ecfeff',
  },
});