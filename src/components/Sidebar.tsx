import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { navigationRef, type RootTabParamList } from '../navigation/navigationRef';

type TabName = keyof RootTabParamList;

const TAB_ITEMS: { name: TabName; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { name: 'Player', icon: 'play-circle', label: 'Player' },
  { name: 'Library', icon: 'musical-notes', label: 'Library' },
  { name: 'Playlists', icon: 'list', label: 'Playlists' },
  { name: 'Settings', icon: 'settings', label: 'Settings' },
];

export function Sidebar() {
  const { isTablet, sidebarWidth, spacing } = useResponsiveLayout();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabName>('Player');

  useEffect(() => {
    if (!isTablet) return;

    const updateActiveTab = () => {
      if (!navigationRef.isReady()) return;
      const state = navigationRef.getRootState();
      const active = state?.routes[state.index];
      const tabName = active ? (active.name as TabName) : null;
      if (tabName && TAB_ITEMS.some((item) => item.name === tabName)) {
        setActiveTab(tabName);
      }
    };

    updateActiveTab();
    return navigationRef.addListener('state', updateActiveTab);
  }, [isTablet]);

  if (!isTablet) {
    return null;
  }

  const handlePress = (name: TabName) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate(name);
    }
  };

  return (
    <View
      style={{
        width: sidebarWidth,
        backgroundColor: colors.tabBar,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        paddingTop: insets.top + spacing.l,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.m,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: 20,
          fontWeight: '700',
          paddingHorizontal: spacing.m,
          paddingBottom: spacing.xl,
        }}
      >
        Coda
      </Text>
      {TAB_ITEMS.map((item) => {
        const isActive = item.name === activeTab;
        return (
          <Pressable
            key={item.name}
            onPress={() => handlePress(item.name)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.m,
              paddingVertical: spacing.m,
              paddingHorizontal: spacing.m,
              borderRadius: 8,
              backgroundColor: isActive ? colors.card : 'transparent',
            }}
          >
            <Ionicons
              name={item.icon}
              size={24}
              color={isActive ? colors.accent : colors.textSecondary}
            />
            <Text
              style={{
                color: isActive ? colors.accent : colors.textSecondary,
                fontSize: 16,
                fontWeight: isActive ? '600' : '400',
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}