import React, { useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IpodRow } from './menus';
import { clampIndex } from './menus';
import { contrastFor } from './ipodTheme';
import type { IpodPalette, ThemeColors } from '../../context/ThemeContext';

interface IpodRowListProps {
  rows: IpodRow[];
  highlight: number;
  onSelect: (index: number) => void;
  colors: ThemeColors;
  ipod: IpodPalette;
}

const ROW_HEIGHT = 52;

export function IpodRowList({ rows, highlight, onSelect, colors, ipod }: IpodRowListProps) {
  const listRef = useRef<FlatList<IpodRow>>(null);

  useEffect(() => {
    const item = listRef.current;
    if (!item) return;
    const index = clampIndex(highlight, rows.length);
    try {
      item.scrollToIndex({ index, animated: true, viewPosition: 0.35 });
    } catch {}
  }, [highlight, rows.length]);

  const highlightText = contrastFor(ipod.highlight);

  const renderRow = ({ item, index }: { item: IpodRow; index: number }) => {
    const selected = index === highlight;
    const fg = selected ? highlightText : colors.text;
    const fgDim = selected ? contrastFor(ipod.highlight) + '99' : colors.textSecondary;
    return (
      <Pressable
        onPress={() => onSelect(index)}
        onLongPress={() => item.longPress?.()}
        style={[
          styles.row,
          { backgroundColor: selected ? ipod.highlight : 'transparent' },
        ]}
      >
        <View style={styles.rowInner}>
          {item.swatchColor ? (
            <View style={[styles.swatch, { backgroundColor: item.swatchColor, borderColor: selected ? fg : colors.border }]} />
          ) : item.kind === 'track' ? (
            <Text style={[styles.index, { color: fgDim }]}>{index + 1}</Text>
          ) : null}
          <View style={styles.labelWrap}>
            <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
              {item.label}
            </Text>
            {item.sub ? (
              <Text style={[styles.sub, { color: fgDim }]} numberOfLines={1}>
                {item.sub}
              </Text>
            ) : null}
          </View>
          {item.right ? (
            <Text style={[styles.right, { color: fgDim }]} numberOfLines={1}>
              {item.right}
            </Text>
          ) : null}
          {item.chevron ? <Ionicons name="chevron-forward" size={16} color={fgDim} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.key}
      renderItem={renderRow}
      getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
      style={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  row: {
    height: ROW_HEIGHT,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  index: {
    width: 26,
    fontSize: 14,
    fontWeight: '500',
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
  },
  labelWrap: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  sub: {
    fontSize: 12,
    marginTop: 1,
  },
  right: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
});