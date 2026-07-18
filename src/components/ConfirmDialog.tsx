import React from 'react';
import { View, StyleSheet, Text, Pressable, Modal } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface DialogAction {
  label: string;
  onPress: () => void;
  style?: 'default' | 'destructive' | 'cancel';
}

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  actions: DialogAction[];
  onClose: () => void;
}

export function ConfirmDialog({ visible, title, message, actions, onClose }: ConfirmDialogProps) {
  const { colors } = useTheme();

  const handleAction = (action: DialogAction) => {
    onClose();
    action.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.dialog, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          ) : null}
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            {actions.map((action, i) => (
              <Pressable
                key={i}
                style={[
                  styles.actionButton,
                  i < actions.length - 1 && { borderRightColor: colors.border },
                ]}
                onPress={() => handleAction(action)}
              >
                <Text
                  style={[
                    styles.actionLabel,
                    {
                      color:
                        action.style === 'destructive'
                          ? '#FF3B30'
                          : action.style === 'cancel'
                          ? colors.textSecondary
                          : colors.accent,
                      fontWeight: action.style === 'destructive' || action.style === 'cancel' ? '600' : '400',
                    },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dialog: {
    borderRadius: 14,
    width: '100%',
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    fontSize: 17,
  },
});
