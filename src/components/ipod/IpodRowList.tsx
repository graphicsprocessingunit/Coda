import React, { useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import type { IpodRow } from './menus';
import { clampIndex } from './menus';
import { IPOD_SCREEN, IPOD_ROW_HEIGHT } from './ipodTheme';
import type { IpodPalette, ThemeColors } from '../../context/ThemeContext';

interface IpodRowListProps {
  rows: IpodRow[];
  highlight: number;
  onSelect: (index: number) => void;
  colors: ThemeColors;
  ipod: IpodPalette;
}

function IpodRowListInner({ rows, highlight, onSelect }: IpodRowListProps) {
  const listRef = useRef<FlatList<IpodRow>>(null);

  useEffect(() => {
    const item = listRef.current;
    if (!item) return;
    const index = clampIndex(highlight, rows.length);
    try {
      item.scrollToIndex({ index, animated: true, viewPosition: 0.35 });
    } catch {}
  }, [highlight, rows.length]);

  const renderRow = ({ item, index }: ListRenderItemInfo<IpodRow>) => {
    if (item.key === 'empty') {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{item.label}</Text>
        </View>
      );
    }
    const selected = index === highlight;
    return (
      <View style={[styles.row, index < rows.length - 1 ? styles.rowDivider : null]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={() => onSelect(index)}
          onLongPress={() => item.longPress?.()}
          style={styles.rowPress}
        >
          {selected ? (
            <View style={styles.highlightBand} pointerEvents="none">
              <View style={[styles.highlightTop, { backgroundColor: IPOD_SCREEN.highlightTop }]} />
              <View style={[styles.highlightBottom, { backgroundColor: IPOD_SCREEN.highlightBottom }]} />
            </View>
          ) : null}
          <View style={styles.rowBody}>
            {item.swatchColor ? (
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: item.swatchColor, borderColor: selected ? '#FFFFFF' : IPOD_SCREEN.chevron },
                ]}
              />
            ) : item.kind === 'track' ? (
              <Text style={[styles.index, { color: selected ? '#FFFFFF' : IPOD_SCREEN.secondary }]}>
                {index + 1}
              </Text>
            ) : null}
            <View style={styles.labelWrap}>
              <Text
                style={[styles.label, { color: selected ? '#FFFFFF' : IPOD_SCREEN.text }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.sub ? (
                <Text
                  style={[styles.sub, { color: selected ? 'rgba(255,255,255,0.85)' : IPOD_SCREEN.secondary }]}
                  numberOfLines={1}
                >
                  {item.sub}
                </Text>
              ) : null}
            </View>
            {item.right ? (
              <Text
                style={[styles.right, { color: selected ? '#FFFFFF' : IPOD_SCREEN.secondary }]}
                numberOfLines={1}
              >
                {item.right}
              </Text>
            ) : null}
            {item.chevron ? (
              <Text style={[styles.chevron, { color: selected ? '#FFFFFF' : IPOD_SCREEN.chevron }]}>›</Text>
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.key}
      renderItem={renderRow}
      getItemLayout={(_, index) => ({ length: IPOD_ROW_HEIGHT, offset: IPOD_ROW_HEIGHT * index, index })}
      style={styles.list}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    />
  );
}

const IpodRowList = React.memo(IpodRowListInner);

export { IpodRowList };

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: IPOD_SCREEN.bg,
  },
  content: {
    paddingBottom: 2,
  },
  row: {
    height: IPOD_ROW_HEIGHT,
    backgroundColor: IPOD_SCREEN.bg,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IPOD_SCREEN.divider,
  },
  rowPress: {
    flex: 1,
  },
  highlightBand: {
    ...StyleSheet.absoluteFillObject,
  },
  highlightTop: {
    flex: 1,
  },
  highlightBottom: {
    flex: 1,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  index: {
    width: 24,
    fontSize: 12,
    fontWeight: '500',
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    marginRight: 10,
  },
  labelWrap: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  sub: {
    fontSize: 11,
    marginTop: 1,
  },
  right: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    fontSize: 20,
    lineHeight: 20,
    marginTop: -2,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 15,
    color: IPOD_SCREEN.secondary,
    fontWeight: '500',
  },
});