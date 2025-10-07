import React, { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  FlatList,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { applyWallpaper } from '../utils/wallpaper';
import {
  BACKGROUND_ASSET_ERRORS,
  ensureBackgroundLocalUri,
  saveBackgroundToCameraRoll,
} from '../utils/backgroundAssets';

export type BackgroundsScreenProps = NativeStackScreenProps<RootStackParamList, 'Backgrounds'>;

type BackgroundTarget = 'home' | 'lock';

const TARGET_OPTIONS: Array<{ label: string; value: BackgroundTarget }> = [
  { label: 'מסך הבית', value: 'home' },
  { label: 'מסך הנעילה', value: 'lock' },
];

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
  const [modalVisible, setModalVisible] = useState(false);
  const [previewBackground, setPreviewBackground] = useState<Background | null>(null);
  const [target, setTarget] = useState<BackgroundTarget>('home');
  const [loadingAction, setLoadingAction] = useState<null | 'apply' | 'save' | 'share'>(null);

  const isIOS = Platform.OS === 'ios';
  const isProcessing = loadingAction !== null;

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

  const handleSelectBackground = (background: Background) => {
    const initialTarget: BackgroundTarget =
      selectedBackground === background._id && selectedBackgroundTarget
        ? selectedBackgroundTarget
        : 'home';

    setPreviewBackground(background);
    setTarget(initialTarget);
    setModalVisible(true);
  };

  const handleCloseModal = (force = false) => {
    if (isProcessing && !force) {
      return;
    }
    setModalVisible(false);
    setPreviewBackground(null);
    setTarget('home');
  };

  const handleApplyWallpaper = async () => {
    if (!previewBackground) return;
    if (isIOS) {
      await handleSaveToLibrary();
      return;
    }
    if (loadingAction) return;

    setLoadingAction('apply');
    try {
      await applyWallpaper(previewBackground, target);
      setSelectedBackground(previewBackground._id, target);
      handleCloseModal(true);
      Alert.alert(
        'הרקע עודכן',
        target === 'lock' ? 'הרקע הוחל על מסך הנעילה.' : 'הרקע הוחל על מסך הבית.'
      );
    } catch (error) {
      console.warn('שגיאה בהחלת רקע', error);
      Alert.alert('שגיאה בהגדרת הרקע', 'לא הצלחנו להחיל את הרקע שבחרת. נסה שוב מאוחר יותר.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!previewBackground) return;
    if (loadingAction) return;

    setLoadingAction('save');
    try {
      await saveBackgroundToCameraRoll(previewBackground);
      setSelectedBackground(previewBackground._id, target);
      handleCloseModal(true);

      if (isIOS) {
        Alert.alert(
          'הרקע נשמר',
          [
            'הרקע נשמר לאלבום התמונות.',
            '',
            'כך תגדירו אותו כרקע:',
            '1. פתחו את אפליקציית התמונות.',
            '2. בחרו את הרקע ששמרתם הרגע.',
            '3. הקישו על שיתוף > השתמש כרקע.',
            target === 'lock' ? '4. בחרו במסך הנעילה ואשרו.' : '4. בחרו במסך הבית ואשרו.',
          ].join('\n')
        );
      } else {
        Alert.alert(
          'הרקע נשמר',
          'הרקע נשמר לאלבום התמונות. ניתן להגדיר אותו כרקע דרך הגדרות המכשיר.'
        );
      }
    } catch (error) {
      console.warn('שגיאה בשמירת רקע', error);
      if (error instanceof Error) {
        if (error.message === BACKGROUND_ASSET_ERRORS.permissionDenied) {
          Alert.alert(
            'נדרשת הרשאה',
            'כדי לשמור רקעים, אפשרו לאפליקציית אמונה גישה לתמונות בהגדרות המכשיר.'
          );
          return;
        }
        if (error.message === BACKGROUND_ASSET_ERRORS.moduleUnavailable) {
          Alert.alert(
            'דרושה התקנה מלאה',
            'כדי לשמור רקעים, ודאו שהאפליקציה נבנתה עם Expo Media Library (הריצו מחדש את הבנייה המקורית של iOS/Android).'
          );
          return;
        }
      }
      Alert.alert('שגיאה בשמירת הרקע', 'לא הצלחנו לשמור את הרקע. נסו שוב מאוחר יותר.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleShareBackground = async () => {
    if (!previewBackground) return;
    if (loadingAction) return;

    setLoadingAction('share');
    try {
      const localUri = await ensureBackgroundLocalUri(previewBackground);
      await Share.share({
        url: localUri,
        message: previewBackground.title
          ? `רקע מאמונה: ${previewBackground.title}`
          : 'רקע מאמונה לשימושך.',
      });
    } catch (error) {
      console.warn('שגיאה בשיתוף הרקע', error);
      Alert.alert('שגיאה בשיתוף', 'לא הצלחנו לשתף את הרקע. נסו שוב מאוחר יותר.');
    } finally {
      setLoadingAction(null);
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
          <PrimaryButton
            label="עריכת זמן ההתראה"
            onPress={handleEditSchedule}
            style={styles.summaryButton}
          />
          <PrimaryButton label="עריכת המחברים" onPress={handleEditAuthors} variant="secondary" />
          <PrimaryButton
            label="שינוי העדפות הציטוטים"
            onPress={handleEditQuoteSettings}
            variant="secondary"
          />
        </View>
      ) : (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>הציטוטים היומיים כבויים כרגע.</Text>
          <PrimaryButton
            label="הפעלת ציטוטים יומיים"
            onPress={handleEnableQuotes}
            style={styles.summaryButton}
          />
        </View>
      )}
    </GlassCard>
  );

  return (
    <>
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => handleCloseModal()}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => handleCloseModal()}
            disabled={isProcessing}
          >
            <View />
          </Pressable>
          {previewBackground ? (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{previewBackground.title ?? 'רקע מותאם'}</Text>
              <ImageBackground
                source={{ uri: previewBackground.imageUrl }}
                style={styles.modalImage}
                imageStyle={styles.modalImageRadius}
              >
                <View style={styles.modalImageOverlay} />
              </ImageBackground>
              <View style={styles.toggleGroup}>
                {TARGET_OPTIONS.map((option) => {
                  const active = target === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.toggleOption, active ? styles.toggleOptionActive : null]}
                      onPress={() => setTarget(option.value)}
                      disabled={isProcessing}
                    >
                      <Text
                        style={[styles.toggleLabel, active ? styles.toggleLabelActive : null]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {isIOS ? (
                <View style={styles.instructions}>
                  <Text style={styles.instructionsTitle}>איך להגדיר את הרקע</Text>
                  <Text style={styles.instructionsItem}>1. פתחו את אפליקציית התמונות.</Text>
                  <Text style={styles.instructionsItem}>2. בחרו את הרקע ששמרתם הרגע.</Text>
                  <Text style={styles.instructionsItem}>3. הקישו על שיתוף › השתמש כרקע.</Text>
                  <Text style={styles.instructionsItem}>
                    4. אשרו למסך המתאים ({target === 'lock' ? 'מסך הנעילה' : 'מסך הבית'}).
                  </Text>
                </View>
              ) : null}
              <PrimaryButton
                label={
                  isIOS
                    ? 'שמירת הרקע לאלבום התמונות'
                    : target === 'lock'
                    ? 'החלת הרקע למסך הנעילה'
                    : 'החלת הרקע למסך הבית'
                }
                onPress={handleApplyWallpaper}
                loading={
                  loadingAction === (isIOS ? 'save' : 'apply')
                }
                disabled={isProcessing && loadingAction !== (isIOS ? 'save' : 'apply')}
              />
              {!isIOS ? (
                <PrimaryButton
                  label="שמירת הרקע לאלבום התמונות"
                  variant="secondary"
                  onPress={handleSaveToLibrary}
                  loading={loadingAction === 'save'}
                  disabled={isProcessing && loadingAction !== 'save'}
                />
              ) : null}
              <PrimaryButton
                label="שיתוף הרקע"
                variant="secondary"
                onPress={handleShareBackground}
                loading={loadingAction === 'share'}
                disabled={isProcessing && loadingAction !== 'share'}
              />
              <PrimaryButton
                label="סגירה"
                variant="secondary"
                onPress={() => handleCloseModal()}
                disabled={isProcessing}
              />
            </View>
          ) : null}
        </View>
      </Modal>
      <ScreenContainer withScroll={false}>
        <FlatList
          data={backgrounds}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <BackgroundCard
              item={item}
              selected={selectedBackground === item._id}
              onSelect={() => handleSelectBackground(item)}
              loading={
                loadingAction !== null && previewBackground?._id === item._id
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadBackgrounds}
              tintColor={colors.accent}
            />
          }
        />
      </ScreenContainer>
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 12, 20, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderRadius: spacing.xl,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  modalImage: {
    height: 240,
    borderRadius: spacing.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  modalImageRadius: {
    borderRadius: spacing.lg,
  },
  modalImageOverlay: {
    height: 80,
    backgroundColor: 'rgba(8, 12, 20, 0.35)',
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  toggleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  toggleOptionActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(244, 196, 48, 0.2)',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleLabelActive: {
    color: colors.accent,
  },
  instructions: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  instructionsItem: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'right',
  },
});
