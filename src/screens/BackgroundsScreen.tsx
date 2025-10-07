import React, { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionSheetIOS, Alert, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { ScreenContainer } from '../components/ScreenContainer';
import { GlassCard } from '../components/GlassCard';
import { BackgroundCard } from '../components/BackgroundCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../theme';
import { Background } from '../api/types';
import { getBackgrounds } from '../api/backgrounds';
import { usePreferences } from '../context/PreferencesContext';
import { formatTime, fromTimeString } from '../utils/time';

export type BackgroundsScreenProps = NativeStackScreenProps<RootStackParamList, 'Backgrounds'>;

export const BackgroundsScreen: React.FC<BackgroundsScreenProps> = ({ navigation }) => {
  const {
    selectedBackground,
    selectedBackgroundTarget,
    setSelectedBackground,
    wantsQuotes,
    favoriteAuthors,
    notificationTime,
    loaded,
  } = usePreferences();
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadBackgrounds = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getBackgrounds();
      setBackgrounds(result);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBackgrounds();
  }, [loadBackgrounds]);

  const handleSelect = (background: Background) => {
    const applySelection = (target: 'home' | 'lock') => {
      setSelectedBackground(background._id, target);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'הגדרת רקע',
          message: 'בחר היכן תרצה להשתמש ברקע שנבחר.',
          options: ['מסך הבית', 'מסך הנעילה', 'ביטול'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            applySelection('home');
          }
          if (buttonIndex === 1) {
            applySelection('lock');
          }
        },
      );
    } else {
      Alert.alert('הגדרת רקע', 'בחר היכן תרצה להשתמש ברקע שנבחר.', [
        { text: 'מסך הבית', onPress: () => applySelection('home') },
        { text: 'מסך הנעילה', onPress: () => applySelection('lock') },
        { text: 'ביטול', style: 'cancel' },
      ]);
    }
  };

  const handleEditSchedule = () => {
    navigation.navigate('Schedule');
  };

  const handleEditAuthors = () => {
    navigation.navigate('Authors');
  };

  const handleEditQuoteSettings = () => {
    navigation.navigate('Welcome');
  };

  const handleEnableQuotes = () => {
    navigation.navigate('Schedule');
  };

  useEffect(() => {
    if (!loaded) return;
    if (wantsQuotes === undefined) {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  }, [loaded, wantsQuotes, navigation]);

  const renderHeader = () => (
    <GlassCard>
      <Text style={styles.heading}>ספריית הרקעים</Text>
      <Text style={styles.subtitle}>החלק ובחר רקע שמעצים אותך. ההגדרות שלך נשמרות אוטומטית.</Text>
      {wantsQuotes ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>התזכורת היומית שלך</Text>
          <Text style={styles.summaryText}>
            שעה: {notificationTime ? formatTime(fromTimeString(notificationTime)) : 'לא נבחרה'}
          </Text>
          <Text style={styles.summaryText}>
            מחברים אהובים: {favoriteAuthors.length ? favoriteAuthors.length : 'לא נבחרו'}
          </Text>
          {selectedBackground ? (
            <Text style={styles.summaryText}>
              יישום הרקע: {selectedBackgroundTarget === 'lock' ? 'מסך הנעילה' : 'מסך הבית'}
            </Text>
          ) : null}
          <PrimaryButton label="עריכת זמן ההתראה" onPress={handleEditSchedule} style={styles.summaryButton} />
          <PrimaryButton label="עריכת המחברים" onPress={handleEditAuthors} variant="secondary" />
          <PrimaryButton label="שינוי העדפות הציטוטים" onPress={handleEditQuoteSettings} variant="secondary" />
        </View>
      ) : (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>הציטוטים היומיים כבויים כרגע.</Text>
          <PrimaryButton label="הפעלת ציטוטים יומיים" onPress={handleEnableQuotes} style={styles.summaryButton} />
        </View>
      )}
    </GlassCard>
  );

  return (
    <ScreenContainer withScroll={false}>
      <FlatList
        data={backgrounds}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <BackgroundCard item={item} selected={selectedBackground === item._id} onSelect={() => handleSelect(item)} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadBackgrounds} tintColor={colors.accent} />}
      />
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
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    justifyContent: 'space-between',
  },
  summaryBox: {
    borderRadius: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
    marginBottom: spacing.xs,
  },
  summaryText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  summaryButton: {
    marginTop: spacing.md,
  },
});
