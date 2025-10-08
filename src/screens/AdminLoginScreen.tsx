import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { ScreenContainer } from '../components/ScreenContainer';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../theme';
import { verifyAdminPassphrase } from '../api/admin';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminLogin'>;

export const AdminLoginScreen: React.FC<Props> = ({ navigation }) => {
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = passphrase.trim();
    if (!trimmed) {
      setError('אנא הזן סיסמה סודית');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const isValid = await verifyAdminPassphrase(trimmed);
      if (!isValid) {
        setError('סיסמה שגויה. נסה שוב.');
        return;
      }

      setPassphrase('');
      navigation.replace('Admin', { adminSecret: trimmed });
    } catch (err) {
      setError('לא ניתן להתחבר לשרת. נסה שוב מאוחר יותר.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigation.replace('Backgrounds');
  };

  return (
    <ScreenContainer>
      <GlassCard>
        <View style={styles.header}>
          <Text style={styles.heading}>כניסת מנהל</Text>
          <Text style={styles.subheading}>סיסמה סודית נדרשת כדי לפתוח את מסך הניהול.</Text>
        </View>
        <TextInput
          value={passphrase}
          onChangeText={setPassphrase}
          placeholder="סיסמה סודית"
          placeholderTextColor="rgba(224, 225, 221, 0.4)"
          secureTextEntry
          editable={!submitting}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="כניסה" onPress={handleSubmit} disabled={submitting} loading={submitting} />
        <PrimaryButton label="ביטול" variant="secondary" onPress={handleCancel} disabled={submitting} />
      </GlassCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  subheading: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 22,
  },
  input: {
    width: '100%',
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 18,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
});
