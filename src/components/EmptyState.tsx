import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface DecorativeIcon {
  name: keyof typeof Ionicons.glyphMap;
  offset: { x: number; y: number };
  size?: number;
  delay?: number;
}

interface EmptyStateAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  decorativeIcons?: DecorativeIcon[];
  title: string;
  subtitle?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

function FloatingIcon({ name, offset, size = 24, delay = 0, color }: {
  name: keyof typeof Ionicons.glyphMap;
  offset: { x: number; y: number };
  size: number;
  delay: number;
  color: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0.4,
        duration: 800,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 800,
        delay,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -4,
          duration: 2000,
          delay: delay + 800,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 4,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity, translateY, delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        transform: [
          { translateX: offset.x },
          { translateY },
        ],
        opacity,
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export function EmptyState({
  icon,
  decorativeIcons = [],
  title,
  subtitle,
  action,
  secondaryAction,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(iconOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 500,
      delay: 200,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scale, iconOpacity, contentOpacity]);

  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconContainer}>
        <Animated.View style={{ opacity: iconOpacity, transform: [{ scale }] }}>
          <Ionicons name={icon} size={56} color={colors.textSecondary} />
        </Animated.View>
        {decorativeIcons.map((d, i) => (
          <FloatingIcon
            key={i}
            name={d.name}
            offset={d.offset}
            size={d.size || 20}
            delay={d.delay || 300 + i * 200}
            color={colors.textSecondary}
          />
        ))}
      </View>

      <Animated.View style={[emptyStyles.textContainer, { opacity: contentOpacity }]}>
        <Text style={[emptyStyles.title, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[emptyStyles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        )}
      </Animated.View>

      <Animated.View style={[emptyStyles.actions, { opacity: contentOpacity }]}>
        {action && (
          <Pressable
            style={[
              emptyStyles.button,
              { backgroundColor: action.primary ? colors.accent : 'transparent' },
              !action.primary && { borderWidth: 1, borderColor: colors.border },
            ]}
            onPress={action.onPress}
          >
            {action.icon && (
              <Ionicons
                name={action.icon}
                size={20}
                color={action.primary ? '#FFFFFF' : colors.text}
              />
            )}
            <Text
              style={[
                emptyStyles.buttonText,
                { color: action.primary ? '#FFFFFF' : colors.text },
                action.icon ? { marginLeft: 8 } : undefined,
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        )}
        {secondaryAction && (
          <Pressable
            style={[
              emptyStyles.button,
              { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
            ]}
            onPress={secondaryAction.onPress}
          >
            {secondaryAction.icon && (
              <Ionicons
                name={secondaryAction.icon}
                size={20}
                color={colors.text}
              />
            )}
            <Text
              style={[
                emptyStyles.buttonText,
                { color: colors.text },
                secondaryAction.icon ? { marginLeft: 8 } : undefined,
              ]}
            >
              {secondaryAction.label}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: {
    alignItems: 'center',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 180,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
