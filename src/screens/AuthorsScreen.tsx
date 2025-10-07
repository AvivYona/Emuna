import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { ScreenContainer } from '../components/ScreenContainer';
import { GlassCard } from '../components/GlassCard';
import { AuthorChip } from '../components/AuthorChip';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../theme';
import { Author } from '../api/types';
import { getAuthors } from '../api/authors';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { usePreferences } from '../context/PreferencesContext';

export type AuthorsScreenProps = NativeStackScreenProps<RootStackParamList, 'Authors'>;

export const AuthorsScreen: React.FC<AuthorsScreenProps> = ({ navigation }) => {
  const { favoriteAuthors, setFavoriteAuthors } = usePreferences();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(favoriteAuthors);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getAuthors();
        setAuthors(result);
      } catch (err) {
        setError('משהו השתבש בטעינת המחברים');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleAuthor = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((authorId) => authorId !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    setSelected(authors.map((author) => author._id));
  };

  const handleContinue = () => {
    setFavoriteAuthors(selected);
    navigation.navigate('Backgrounds');
  };

  const canContinue = useMemo(() => selected.length > 0, [selected]);

  return (
    <ScreenContainer>
      <GlassCard>
        <Text style={styles.heading}>בחר את המקורות שמדברים אליך</Text>
        <Text style={styles.subtitle}>אפשר לבחור יותר ממחבר אחד, ואפשר גם לערבב עבור המלצה מהירה.</Text>
        <PrimaryButton label="בחר את כולם" onPress={handleSelectAll} variant="secondary" />
        {loading ? (
          <LoadingState label="טוען מחברים..." />
        ) : error ? (
          <EmptyState message={error} />
        ) : (
          <View style={styles.chipsContainer}>
            {authors.map((author) => (
              <AuthorChip key={author._id} name={author.name} selected={selected.includes(author._id)} onToggle={() => toggleAuthor(author._id)} />
            ))}
          </View>
        )}
        <PrimaryButton label="המשך" onPress={handleContinue} disabled={!canContinue} />
      </GlassCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginVertical: spacing.md,
  },
});
