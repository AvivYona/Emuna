import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Keyboard,
  useWindowDimensions,
  I18nManager,
  View,
  LayoutChangeEvent,
  InteractionManager,
  TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system";
import { ScreenContainer } from "../components/ScreenContainer";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  BackgroundSelectionParam,
  RootStackParamList,
} from "../navigation/RootNavigator";
import { Background, Quote } from "../api/types";
import { getQuotes } from "../api/quotes";
import { saveCustomBackground } from "../storage/customBackgroundsStorage";
import { colors, spacing } from "../theme";

type CreateBackgroundScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "CreateBackground"
>;

type Position = {
  x: number;
  y: number;
};

type EditableText = {
  id: string;
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: TextStyle["fontWeight"];
  color: string;
  position: Position;
};

type DraggableTextProps = {
  item: EditableText;
  selected: boolean;
  onSelect(id: string): void;
  onMove(id: string, position: Position): void;
  onEdit(id: string): void;
  onResize(id: string, nextSize: number): void;
  canvasWidth: number;
  canvasHeight: number;
  showEditingChrome: boolean;
  editing: boolean;
  onChangeContent(id: string, content: string): void;
  onFinishEditing(id: string): void;
};

type TextPanel = "font" | "color" | "size" | null;

const TEXT_ICON_BAR_WIDTH = 40;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 110;
const TEXT_BOUNDARY_MARGIN = 48;
const RESIZE_HANDLE_SIZE = 18;
const RESIZE_HANDLE_OFFSET = RESIZE_HANDLE_SIZE / 2;
const RESIZE_SCALE_FACTOR = 0.35;
const COLOR_GRADIENT_STOPS = [
  "#ff0000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#ff00ff",
  "#ff0000",
] as const;
const COLOR_GRADIENT_HEIGHT = 24;
const COLOR_THUMB_SIZE = 20;
const CUSTOM_BACKGROUND_DIRECTORY = "custom-backgrounds";

const ensureTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value : `${value}/`;

const buildDirectoryPath = (base: string, folder: string): string =>
  ensureTrailingSlash(
    ensureTrailingSlash(base).concat(folder.replace(/^\/+/, ""))
  );

const normalizeFileUri = (uri: string): string => {
  if (!uri) {
    return uri;
  }
  if (uri.startsWith("file://")) {
    return uri;
  }
  if (uri.startsWith("file:")) {
    const withoutScheme = uri.replace(/^file:\/*/, "");
    const normalizedPath = withoutScheme.startsWith("/")
      ? withoutScheme
      : `/${withoutScheme}`;
    return `file://${normalizedPath}`;
  }
  return uri;
};

async function ensureDirectoryExists(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) {
    if (!info.isDirectory) {
      throw new Error("CUSTOM_BACKGROUND_DIR_CONFLICT");
    }
    return;
  }
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

async function waitForCondition(
  test: () => boolean,
  attempts = 10,
  delayMs = 60
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (test()) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }
}

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const clampColorComponent = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

const componentToHex = (value: number): string =>
  clampColorComponent(value).toString(16).padStart(2, "0");

const rgbToHex = ({ r, g, b }: RgbColor): string =>
  `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;

const hexToRgb = (value: string | undefined): RgbColor | null => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.split("");
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return {
      r: parseInt(trimmed.slice(0, 2), 16),
      g: parseInt(trimmed.slice(2, 4), 16),
      b: parseInt(trimmed.slice(4, 6), 16),
    };
  }
  return null;
};

const rgbToHue = ({ r, g, b }: RgbColor): number => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  if (delta === 0) {
    return 0;
  }
  let hue = 0;
  switch (max) {
    case rNorm:
      hue = ((gNorm - bNorm) / delta) % 6;
      break;
    case gNorm:
      hue = (bNorm - rNorm) / delta + 2;
      break;
    default:
      hue = (rNorm - gNorm) / delta + 4;
      break;
  }
  hue *= 60;
  if (hue < 0) {
    hue += 360;
  }
  return hue;
};

const hueToRgb = (p: number, q: number, t: number) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

const hueToHex = (hue: number, saturation = 1, lightness = 0.5): string => {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(1, saturation));
  const l = Math.max(0, Math.min(1, lightness));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h / 360 + 1 / 3);
  const g = hueToRgb(p, q, h / 360);
  const b = hueToRgb(p, q, h / 360 - 1 / 3);
  return rgbToHex({
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  });
};

const FONT_OPTIONS: Array<{ label: string; value: string }> = [
  {
    label: "קלאסי",
    value:
      Platform.select({
        ios: "Times New Roman",
        android: "serif",
        default: "serif",
      }) ?? "serif",
  },
  {
    label: "מודרני",
    value:
      Platform.select({
        ios: "Avenir Next",
        android: "sans-serif",
        default: "sans-serif",
      }) ?? "sans-serif",
  },
  {
    label: "נקי",
    value:
      Platform.select({
        ios: "Helvetica Neue",
        android: "sans-serif-light",
        default: "sans-serif",
      }) ?? "sans-serif",
  },
  {
    label: "כתב מודגש",
    value:
      Platform.select({
        ios: "Arial Hebrew",
        android: "sans-serif-medium",
        default: "sans-serif",
      }) ?? "sans-serif",
  },
  {
    label: "עגול",
    value:
      Platform.select({
        ios: "Gill Sans",
        android: "sans-serif",
        default: "sans-serif",
      }) ?? "sans-serif",
  },
  {
    label: "כתב יד",
    value:
      Platform.select({
        ios: "Snell Roundhand",
        android: "casual",
        default: "cursive",
      }) ?? "cursive",
  },
];

const FONT_WEIGHT_OPTIONS: Array<{
  label: string;
  value: TextStyle["fontWeight"];
}> = [
  { label: "רגיל", value: "400" },
  { label: "מודגש", value: "600" },
  { label: "חזק", value: "700" },
];

const COLOR_SWATCHES = [
  "#3A2016",
  "#8C4A35",
  "#B98568",
  "#FFFFFF",
  "#2D4B73",
  "#3FA796",
  "#C94C4C",
];

const TEXT_ICON_BUTTONS: Array<{
  key: "add" | "quotes" | "font" | "color" | "size" | "delete";
  label: string;
  icon: string;
}> = [
  { key: "add", label: "הוספת טקסט", icon: "＋" },
  { key: "quotes", label: "ציטוטים", icon: "📜" },
  { key: "font", label: "גופנים", icon: "A" },
  { key: "color", label: "צבע", icon: "🎨" },
  { key: "size", label: "גודל", icon: "↕" },
  { key: "delete", label: "מחיקה", icon: "🗑️" },
];

const DraggableText: React.FC<DraggableTextProps> = ({
  item,
  selected,
  onSelect,
  onMove,
  onEdit,
  onResize,
  canvasWidth,
  canvasHeight,
  showEditingChrome,
  editing,
  onChangeContent,
  onFinishEditing,
}) => {
  const startPositionRef = React.useRef(item.position);
  const lastTapRef = React.useRef<number>(0);
  const initialFontRef = React.useRef(item.fontSize);
  const horizontalSign = I18nManager.getConstants
    ? I18nManager.getConstants().isRTL
      ? -1
      : 1
    : I18nManager.isRTL
    ? -1
    : 1;

  useEffect(() => {
    startPositionRef.current = item.position;
  }, [item.position]);

  useEffect(() => {
    initialFontRef.current = item.fontSize;
  }, [item.fontSize]);

  const clampPosition = useCallback(
    (position: Position): Position => {
      const maxX = Math.max(0, canvasWidth - TEXT_BOUNDARY_MARGIN);
      const maxY = Math.max(0, canvasHeight - TEXT_BOUNDARY_MARGIN);
      return {
        x: Math.max(0, Math.min(position.x, maxX)),
        y: Math.max(0, Math.min(position.y, maxY)),
      };
    },
    [canvasHeight, canvasWidth]
  );

  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          onSelect(item.id);
          startPositionRef.current = item.position;
        },
        onPanResponderMove: (_, gestureState) => {
          const adjustedDx = gestureState.dx * horizontalSign;
          const nextPosition = clampPosition({
            x: startPositionRef.current.x + adjustedDx,
            y: startPositionRef.current.y + gestureState.dy,
          });
          onMove(item.id, nextPosition);
        },
        onPanResponderRelease: (_, gestureState) => {
          const adjustedDx = gestureState.dx * horizontalSign;
          const nextPosition = clampPosition({
            x: startPositionRef.current.x + adjustedDx,
            y: startPositionRef.current.y + gestureState.dy,
          });
          onMove(item.id, nextPosition);
          const isTap =
            Math.abs(adjustedDx) < 6 && Math.abs(gestureState.dy) < 6;
          if (isTap) {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
              lastTapRef.current = 0;
              onEdit(item.id);
            } else {
              lastTapRef.current = now;
            }
          }
        },
      }),
    [
      clampPosition,
      horizontalSign,
      item.id,
      item.position,
      onEdit,
      onMove,
      onSelect,
    ]
  );

  const applySizeDelta = useCallback(
    (delta: number) => {
      const next = Math.max(
        MIN_FONT_SIZE,
        Math.min(
          MAX_FONT_SIZE,
          initialFontRef.current + delta * RESIZE_SCALE_FACTOR
        )
      );
      onResize(item.id, next);
    },
    [item.id, onResize]
  );

  const createEdgeResponder = useCallback(
    (direction: "left" | "right" | "top" | "bottom") =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          initialFontRef.current = item.fontSize;
          onSelect(item.id);
        },
        onPanResponderMove: (_, gestureState) => {
          const adjustedDx = gestureState.dx * horizontalSign;
          const delta =
            direction === "left"
              ? -adjustedDx
              : direction === "right"
              ? adjustedDx
              : direction === "top"
              ? -gestureState.dy
              : gestureState.dy;
          applySizeDelta(delta);
        },
        onPanResponderRelease: (_, gestureState) => {
          const adjustedDx = gestureState.dx * horizontalSign;
          const delta =
            direction === "left"
              ? -adjustedDx
              : direction === "right"
              ? adjustedDx
              : direction === "top"
              ? -gestureState.dy
              : gestureState.dy;
          applySizeDelta(delta);
        },
      }),
    [applySizeDelta, horizontalSign, item.fontSize, item.id, onSelect]
  );

  const leftResizeResponder = useMemo(
    () => createEdgeResponder("left"),
    [createEdgeResponder]
  );
  const rightResizeResponder = useMemo(
    () => createEdgeResponder("right"),
    [createEdgeResponder]
  );
  const topResizeResponder = useMemo(
    () => createEdgeResponder("top"),
    [createEdgeResponder]
  );
  const bottomResizeResponder = useMemo(
    () => createEdgeResponder("bottom"),
    [createEdgeResponder]
  );

  const showHighlight = showEditingChrome && selected;
  const showHandles = showHighlight && !editing;

  return (
    <View
      style={[
        styles.draggableText,
        {
          left: item.position.x,
          top: item.position.y,
          borderColor: showHighlight ? colors.accent : "transparent",
          backgroundColor: showHighlight
            ? "rgba(255, 255, 255, 0.35)"
            : "transparent",
        },
      ]}
      {...(showEditingChrome && !editing ? moveResponder.panHandlers : {})}
    >
      {editing ? (
        <TextInput
          value={item.content}
          onChangeText={(value) => onChangeContent(item.id, value)}
          autoFocus
          multiline
          blurOnSubmit
          style={[
            styles.draggableTextContent,
            styles.draggableTextInput,
            {
              fontFamily: item.fontFamily,
              fontSize: item.fontSize,
              fontWeight: item.fontWeight ?? "400",
              color: item.color,
            },
          ]}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          onBlur={() => onFinishEditing(item.id)}
          onSubmitEditing={() => onFinishEditing(item.id)}
          underlineColorAndroid="transparent"
        />
      ) : (
        <Text
          style={[
            styles.draggableTextContent,
            {
              fontFamily: item.fontFamily,
              fontSize: item.fontSize,
              fontWeight: item.fontWeight ?? "400",
              color: item.color,
            },
          ]}
        >
          {item.content}
        </Text>
      )}
      {showHandles ? (
        <>
          <View
            style={[styles.resizeHandle, styles.resizeHandleTop]}
            {...topResizeResponder.panHandlers}
          />
          <View
            style={[styles.resizeHandle, styles.resizeHandleBottom]}
            {...bottomResizeResponder.panHandlers}
          />
          <View
            style={[styles.resizeHandle, styles.resizeHandleLeft]}
            {...leftResizeResponder.panHandlers}
          />
          <View
            style={[styles.resizeHandle, styles.resizeHandleRight]}
            {...rightResizeResponder.panHandlers}
          />
        </>
      ) : null}
    </View>
  );
};

const QuoteCard: React.FC<{ quote: Quote; onSelect(): void }> = ({
  quote,
  onSelect,
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.quoteCard,
      pressed ? styles.quoteCardPressed : null,
    ]}
    onPress={onSelect}
  >
    <Text style={styles.quoteText}>{quote.quote}</Text>
    <Text style={styles.quoteAuthor}>{quote.author.name}</Text>
  </Pressable>
);

export const CreateBackgroundScreen: React.FC<CreateBackgroundScreenProps> = ({
  navigation,
  route,
}) => {
  const { initialBackground } = route.params;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [texts, setTexts] = useState<EditableText[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [canvasBackgroundUri, setCanvasBackgroundUri] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [showQuoteLibrary, setShowQuoteLibrary] = useState(false);
  const [canvasBackgroundReady, setCanvasBackgroundReady] = useState(false);
  const [viewShotLayoutReady, setViewShotLayoutReady] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activeTextPanel, setActiveTextPanel] = useState<TextPanel>(null);
  const [showEditingChrome, setShowEditingChrome] = useState(true);
  const [confirmExitVisible, setConfirmExitVisible] = useState(false);

  const canvasCaptureRef = React.useRef<View | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const canvasDimensions = useMemo(() => {
    const phoneAspectRatio = 19.5 / 9;
    const availableWidth = windowWidth - TEXT_ICON_BAR_WIDTH - spacing.xl * 2;
    const maxWidth = Math.max(260, availableWidth);
    let width = maxWidth;
    let height = width * phoneAspectRatio;
    const maxHeight = windowHeight * 0.7;
    if (height > maxHeight) {
      height = maxHeight;
      width = height / phoneAspectRatio;
    }
    return { width, height };
  }, [windowHeight, windowWidth]);

  const selectedText = useMemo(
    () =>
      selectedTextId
        ? texts.find((item) => item.id === selectedTextId) ?? null
        : null,
    [selectedTextId, texts]
  );

  const defaultRgb = hexToRgb(colors.textPrimary) ?? {
    r: 58,
    g: 32,
    b: 22,
  };
  const [customHue, setCustomHue] = useState<number>(() =>
    rgbToHue(defaultRgb)
  );
  const [customRgb, setCustomRgb] = useState<RgbColor>(defaultRgb);
  const [customRgbInput, setCustomRgbInput] = useState<{
    r: string;
    g: string;
    b: string;
  }>(() => ({
    r: String(defaultRgb.r),
    g: String(defaultRgb.g),
    b: String(defaultRgb.b),
  }));
  const [gradientWidth, setGradientWidth] = useState(0);
  const customHexColor = useMemo(() => rgbToHex(customRgb), [customRgb]);

  useEffect(() => {
    if (!selectedText) {
      setActiveTextPanel(null);
    }
  }, [selectedText]);

  useEffect(() => {
    if (!selectedText) {
      return;
    }
    const parsed = hexToRgb(selectedText.color);
    if (parsed) {
      setCustomRgb(parsed);
      setCustomHue(rgbToHue(parsed));
    }
  }, [selectedText?.color]);

  useEffect(() => {
    setCustomRgbInput({
      r: String(customRgb.r),
      g: String(customRgb.g),
      b: String(customRgb.b),
    });
  }, [customRgb]);

  useEffect(() => {
    if (initialBackground.type === "clean") {
      setCanvasBackgroundUri(initialBackground.background.imageUrl);
    } else {
      setCanvasBackgroundUri(initialBackground.uri);
    }
    setCanvasBackgroundReady(false);
    setViewShotLayoutReady(false);
  }, [initialBackground]);

  useEffect(() => {
    if (!canvasBackgroundUri) {
      setCanvasBackgroundReady(true);
    } else {
      setCanvasBackgroundReady(false);
    }
    setViewShotLayoutReady(false);
  }, [canvasBackgroundUri]);

  useEffect(() => {
    setViewShotLayoutReady(false);
  }, [canvasDimensions.height, canvasDimensions.width]);

  const updateText = useCallback(
    (id: string, updater: (current: EditableText) => EditableText) => {
      setTexts((items) =>
        items.map((item) => (item.id === id ? updater(item) : item))
      );
    },
    []
  );

  const clampPosition = useCallback(
    (position: Position): Position => {
      const maxX = Math.max(0, canvasDimensions.width - TEXT_BOUNDARY_MARGIN);
      const maxY = Math.max(0, canvasDimensions.height - TEXT_BOUNDARY_MARGIN);
      return {
        x: Math.max(0, Math.min(position.x, maxX)),
        y: Math.max(0, Math.min(position.y, maxY)),
      };
    },
    [canvasDimensions.height, canvasDimensions.width]
  );

  const loadQuotes = useCallback(async () => {
    setQuotesLoading(true);
    try {
      const data = await getQuotes();
      setQuotes(data);
    } catch (error) {
      console.warn("Failed to load quotes", error);
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  const handleAddQuote = useCallback(
    (quote: Quote) => {
      const id = `quote-${quote._id}-${Date.now()}`;
      const basePosition = clampPosition({
        x: canvasDimensions.width * 0.1,
        y: canvasDimensions.height * 0.2,
      });
      setTexts((items) => [
        ...items,
        {
          id,
          content: quote.quote,
          fontSize: 30,
          fontFamily:
            FONT_OPTIONS[0]?.value ??
            (Platform.OS === "ios" ? "Georgia" : "serif"),
          fontWeight: FONT_WEIGHT_OPTIONS[1]?.value ?? "600",
          color: colors.textPrimary,
          position: basePosition,
        },
      ]);
      setSelectedTextId(id);
      setEditingTextId(id);
      setShowQuoteLibrary(false);
    },
    [canvasDimensions.height, canvasDimensions.width, clampPosition]
  );

  const handleAddCustomText = useCallback(() => {
    const id = `custom-${Date.now()}`;
    const basePosition = clampPosition({
      x: canvasDimensions.width * 0.2,
      y: canvasDimensions.height * 0.35,
    });
    const content = "טקסט חדש";
    const fontFamily =
      FONT_OPTIONS[1]?.value ??
      (Platform.OS === "ios" ? "Avenir Next" : "sans-serif-medium");
    setTexts((items) => [
      ...items,
      {
        id,
        content,
        fontSize: 34,
        fontFamily,
        fontWeight: FONT_WEIGHT_OPTIONS[1]?.value ?? "600",
        color: colors.textPrimary,
        position: basePosition,
      },
    ]);
    setSelectedTextId(id);
    setEditingTextId(id);
  }, [canvasDimensions.height, canvasDimensions.width, clampPosition]);

  const handleMoveText = useCallback(
    (id: string, position: Position) => {
      updateText(id, (item) => ({
        ...item,
        position: clampPosition(position),
      }));
    },
    [clampPosition, updateText]
  );

  const handleChangeTextContent = useCallback(
    (id: string, content: string) => {
      updateText(id, (item) => ({
        ...item,
        content,
      }));
    },
    [updateText]
  );

  const handleChangeFont = useCallback(
    (id: string, fontFamily: string) => {
      updateText(id, (item) => ({
        ...item,
        fontFamily,
      }));
    },
    [updateText]
  );

  const handleChangeFontWeight = useCallback(
    (id: string, fontWeight: TextStyle["fontWeight"]) => {
      updateText(id, (item) => ({
        ...item,
        fontWeight,
      }));
    },
    [updateText]
  );

  const handleChangeColor = useCallback(
    (id: string, colorValue: string) => {
      updateText(id, (item) => ({
        ...item,
        color: colorValue,
      }));
      if (selectedTextId === id) {
        const parsed = hexToRgb(colorValue);
        if (parsed) {
          setCustomRgb(parsed);
          setCustomHue(rgbToHue(parsed));
        }
      }
    },
    [selectedTextId, updateText]
  );

  const handleHueAtPosition = useCallback(
    (position: number) => {
      if (gradientWidth <= 0 || !selectedText) {
        return;
      }
      const ratio = Math.max(0, Math.min(1, position / gradientWidth));
      const nextHue = ratio * 360;
      handleChangeColor(selectedText.id, hueToHex(nextHue));
    },
    [gradientWidth, handleChangeColor, selectedText]
  );

  const gradientIndicatorPosition = useMemo(() => {
    if (gradientWidth <= 0) {
      return 0;
    }
    return (customHue / 360) * gradientWidth;
  }, [customHue, gradientWidth]);

  const handleGradientLayout = useCallback((event: LayoutChangeEvent) => {
    setGradientWidth(event.nativeEvent.layout.width);
  }, []);

  const gradientPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          handleHueAtPosition(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          handleHueAtPosition(evt.nativeEvent.locationX);
        },
      }),
    [handleHueAtPosition]
  );

  const handleChangeRgbComponent = useCallback(
    (component: keyof RgbColor, rawValue: string) => {
      const digitsOnly = rawValue.replace(/\D/g, "").slice(0, 3);
      setCustomRgbInput((prev) => ({
        ...prev,
        [component]: digitsOnly,
      }));
      const parsedValue = digitsOnly.length ? parseInt(digitsOnly, 10) : 0;
      const clampedValue = Math.max(
        0,
        Math.min(255, Number.isNaN(parsedValue) ? 0 : parsedValue)
      );
      const nextRgb = {
        ...customRgb,
        [component]: clampedValue,
      };
      setCustomRgb(nextRgb);
      setCustomHue(rgbToHue(nextRgb));
      const nextHex = rgbToHex(nextRgb);
      if (selectedText) {
        handleChangeColor(selectedText.id, nextHex);
      }
    },
    [customRgb, handleChangeColor, selectedText]
  );

  const handleAdjustFontSize = useCallback(
    (id: string, delta: number) => {
      updateText(id, (item) => ({
        ...item,
        fontSize: Math.max(
          MIN_FONT_SIZE,
          Math.min(MAX_FONT_SIZE, item.fontSize + delta)
        ),
      }));
    },
    [updateText]
  );

  const handleResizeText = useCallback(
    (id: string, nextSize: number) => {
      updateText(id, (item) => ({
        ...item,
        fontSize: Math.max(
          MIN_FONT_SIZE,
          Math.min(MAX_FONT_SIZE, Math.round(nextSize))
        ),
      }));
    },
    [updateText]
  );

  const handleRemoveText = useCallback((id: string) => {
    setTexts((items) => items.filter((item) => item.id !== id));
    setSelectedTextId((current) => (current === id ? null : current));
  }, []);

  const handleStartEditing = useCallback((id: string) => {
    setSelectedTextId(id);
    setActiveTextPanel(null);
    setEditingTextId(id);
  }, []);

  const handleFinishEditing = useCallback((id: string) => {
    setEditingTextId((current) => (current === id ? null : current));
    Keyboard.dismiss();
  }, []);

  const handleCanvasPress = useCallback(() => {
    if (editingTextId !== null) {
      setEditingTextId(null);
      Keyboard.dismiss();
    }
    setSelectedTextId(null);
    setActiveTextPanel(null);
  }, [editingTextId]);

  const handleSaveBackground = useCallback(async () => {
    if (saving) {
      return;
    }
    if (!canvasCaptureRef.current) {
      Alert.alert("שגיאה", "לא הצלחנו לגשת לשטח העריכה. נסו שוב.");
      return;
    }
    if (canvasBackgroundUri && !canvasBackgroundReady) {
      Alert.alert("התמונה עדיין נטענת", "המתינו לסיום טעינת הרקע לפני השמירה.");
      return;
    }
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert("שגיאה", "התקן אינו תומך בשמירת קבצים מקומית.");
      return;
    }

    setSaving(true);
    try {
      setActiveTextPanel(null);
      setSelectedTextId(null);
      setEditingTextId(null);
      setShowEditingChrome(false);
      await new Promise<void>((resolve) =>
        InteractionManager.runAfterInteractions(() => resolve())
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 80));
      await waitForCondition(() => viewShotLayoutReady, 12, 40);
      if (!viewShotLayoutReady) {
        throw new Error("CANVAS_LAYOUT_PENDING");
      }
      let captureUri: string | undefined;
      let captureError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const targetNode = canvasCaptureRef.current;
          if (!targetNode) {
            throw new Error("CAPTURE_TARGET_MISSING");
          }
          captureUri = await captureRef(targetNode, {
            format: "jpg",
            quality: 0.95,
            result: "tmpfile",
            snapshotContentContainer: false,
          });
          if (captureUri) {
            break;
          }
        } catch (error) {
          captureError = error;
          if (
            attempt < 2 &&
            error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code?: string }).code === "E_UNABLE_TO_SNAPSHOT"
          ) {
            await new Promise<void>((resolve) => setTimeout(resolve, 120));
            continue;
          }
          throw error;
        }
      }
      if (!captureUri) {
        if (captureError) {
          throw captureError;
        }
        throw new Error("CAPTURE_FAILED");
      }
      const identifier = `custom-${Date.now()}`;
      const targetDir = buildDirectoryPath(
        baseDir,
        CUSTOM_BACKGROUND_DIRECTORY
      );
      try {
        await ensureDirectoryExists(targetDir);
      } catch (dirError) {
        console.warn("Failed to prepare custom background directory", dirError);
        throw dirError;
      }
      const normalizedCaptureUri = normalizeFileUri(captureUri);
      const captureInfo = await FileSystem.getInfoAsync(normalizedCaptureUri);
      if (!captureInfo.exists) {
        throw new Error("CAPTURE_FILE_MISSING");
      }
      const targetPath = `${targetDir}${identifier}.jpg`;
      try {
        await FileSystem.deleteAsync(targetPath, { idempotent: true });
      } catch (cleanupError) {
        console.warn("Failed to remove previous background file", cleanupError);
      }
      let persistedSuccessfully = false;
      try {
        await FileSystem.moveAsync({
          from: normalizedCaptureUri,
          to: targetPath,
        });
        persistedSuccessfully = true;
      } catch (moveError) {
        console.warn("Failed to move captured background", moveError);
      }

      if (!persistedSuccessfully) {
        try {
          await FileSystem.copyAsync({
            from: normalizedCaptureUri,
            to: targetPath,
          });
          persistedSuccessfully = true;
        } catch (copyError) {
          console.warn("Failed to copy captured background", copyError);
          throw copyError;
        }
        try {
          await FileSystem.deleteAsync(normalizedCaptureUri, {
            idempotent: true,
          });
        } catch (cleanupError) {
          console.warn("Failed to delete captured temp file", cleanupError);
        }
      }

      const persistedInfo = await FileSystem.getInfoAsync(targetPath);
      if (!persistedInfo.exists) {
        throw new Error("CUSTOM_BACKGROUND_PERSIST_FAILED");
      }

      const background: Background = {
        _id: identifier,
        imageUrl: targetPath,
        thumbnailUrl: targetPath,
        displayName: "רקע אישי",
      };

      await saveCustomBackground(background);

      navigation.navigate("Backgrounds", {
        highlightBackgroundId: identifier,
      });
    } catch (error) {
      console.warn("Failed to save custom background", error);
      Alert.alert("משהו השתבש", "לא הצלחנו לשמור את הרקע. נסו שוב מאוחר יותר.");
    } finally {
      setShowEditingChrome(true);
      setSaving(false);
    }
  }, [
    canvasBackgroundReady,
    canvasBackgroundUri,
    navigation,
    saving,
    viewShotLayoutReady,
  ]);

  const handleBackToLibrary = useCallback(() => {
    setConfirmExitVisible(true);
  }, []);

  const handleCancelExit = useCallback(() => {
    setConfirmExitVisible(false);
  }, []);

  const handleConfirmExit = useCallback(() => {
    setConfirmExitVisible(false);
    navigation.goBack();
  }, [navigation]);

  const disableTextTools = !selectedText;
  const disableSaveAction =
    saving ||
    (canvasBackgroundUri !== null && !canvasBackgroundReady) ||
    !viewShotLayoutReady;

  const renderTextPanel = () => {
    if (!selectedText || !activeTextPanel) {
      return null;
    }
    if (activeTextPanel === "font") {
      const normalizeWeight = (
        weight: TextStyle["fontWeight"] | undefined
      ): TextStyle["fontWeight"] => {
        if (!weight) return "400";
        if (weight === "bold") return "700";
        if (weight === "normal") return "400";
        return weight;
      };
      const selectedWeight = normalizeWeight(selectedText.fontWeight);
      return (
        <View style={[styles.floatingPanel, styles.fontPanel]}>
          <Text style={styles.panelTitle}>בחירת גופן</Text>
          <ScrollView
            style={styles.fontScroll}
            contentContainerStyle={styles.fontScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {FONT_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.panelOption,
                  selectedText.fontFamily === option.value
                    ? styles.panelOptionSelected
                    : null,
                  pressed ? styles.panelOptionPressed : null,
                ]}
                onPress={() => handleChangeFont(selectedText.id, option.value)}
              >
                <Text
                  style={[
                    styles.panelOptionLabel,
                    { fontFamily: option.value },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.fontWeightSection}>
            <Text style={styles.fontWeightTitle}>עובי האותיות</Text>
            <View style={styles.fontWeightButtons}>
              {FONT_WEIGHT_OPTIONS.map((option) => {
                const isSelected =
                  normalizeWeight(option.value) === selectedWeight;
                return (
                  <Pressable
                    key={option.value ?? option.label}
                    style={({ pressed }) => [
                      styles.fontWeightButton,
                      isSelected ? styles.fontWeightButtonSelected : null,
                      pressed && !isSelected
                        ? styles.fontWeightButtonPressed
                        : null,
                    ]}
                    onPress={() =>
                      handleChangeFontWeight(selectedText.id, option.value)
                    }
                  >
                    <Text
                      style={[
                        styles.fontWeightButtonLabel,
                        isSelected
                          ? styles.fontWeightButtonLabelSelected
                          : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.panelCloseButton,
              pressed ? styles.panelCloseButtonPressed : null,
            ]}
            onPress={() => setActiveTextPanel(null)}
          >
            <Text style={styles.panelCloseLabel}>סגירה</Text>
          </Pressable>
        </View>
      );
    }
    if (activeTextPanel === "color") {
      return (
        <View style={styles.floatingPanel}>
          <Text style={styles.panelTitle}>צבע הטקסט</Text>
          <View style={styles.colorRow}>
            {COLOR_SWATCHES.map((colorValue) => (
              <Pressable
                key={colorValue}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: colorValue },
                  selectedText.color === colorValue
                    ? styles.colorSwatchSelected
                    : null,
                ]}
                onPress={() => handleChangeColor(selectedText.id, colorValue)}
              />
            ))}
          </View>
          <View style={styles.customColorSection}>
            <Text style={styles.customColorTitle}>צבע מותאם אישית</Text>
            <View
              style={[
                styles.customColorPreview,
                { backgroundColor: customHexColor },
              ]}
            />
            <View
              style={styles.customColorGradientContainer}
              onLayout={handleGradientLayout}
              {...gradientPanResponder.panHandlers}
            >
              <LinearGradient
                colors={COLOR_GRADIENT_STOPS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.customColorGradient}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.customColorThumb,
                  {
                    right:
                      Math.max(
                        0,
                        Math.min(gradientWidth, gradientIndicatorPosition)
                      ) -
                      COLOR_THUMB_SIZE / 2,
                    backgroundColor: customHexColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.customColorHex}>{customHexColor}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.panelCloseButton,
              pressed ? styles.panelCloseButtonPressed : null,
            ]}
            onPress={() => setActiveTextPanel(null)}
          >
            <Text style={styles.panelCloseLabel}>סגירה</Text>
          </Pressable>
        </View>
      );
    }
    if (activeTextPanel === "size") {
      return (
        <View style={styles.floatingPanel}>
          <Text style={styles.panelTitle}>גודל הטקסט</Text>
          <View style={styles.fontControls}>
            <Pressable
              style={({ pressed }) => [
                styles.fontButton,
                pressed ? styles.fontButtonPressed : null,
              ]}
              onPress={() => handleAdjustFontSize(selectedText.id, -2)}
            >
              <Text style={styles.fontButtonLabel}>A-</Text>
            </Pressable>
            <Text style={styles.fontSizeLabel}>
              {Math.round(selectedText.fontSize)}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.fontButton,
                pressed ? styles.fontButtonPressed : null,
              ]}
              onPress={() => handleAdjustFontSize(selectedText.id, 2)}
            >
              <Text style={styles.fontButtonLabel}>A+</Text>
            </Pressable>
          </View>
          <Text style={styles.helperText}>
            ניתן גם לגרור את הידית בטקסט כדי לשנות גודל.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.panelCloseButton,
              pressed ? styles.panelCloseButtonPressed : null,
            ]}
            onPress={() => setActiveTextPanel(null)}
          >
            <Text style={styles.panelCloseLabel}>סגירה</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  };

  return (
    <ScreenContainer withScroll={false} avoidKeyboard={false}>
      <View style={styles.editorRow}>
        <View style={[styles.iconBar, styles.iconBarLeft]}>
          {TEXT_ICON_BUTTONS.map((button) => {
            const disabled =
              disableTextTools &&
              ["font", "color", "size", "delete"].includes(button.key);
            const handlePress = () => {
              if (button.key === "add") {
                handleAddCustomText();
              } else if (button.key === "quotes") {
                setShowQuoteLibrary(true);
              } else if (!selectedText) {
                return;
              } else if (button.key === "font") {
                setActiveTextPanel("font");
              } else if (button.key === "color") {
                setActiveTextPanel("color");
              } else if (button.key === "size") {
                setActiveTextPanel("size");
              } else if (button.key === "delete" && selectedText) {
                handleRemoveText(selectedText.id);
              }
            };
            return (
              <Pressable
                key={button.key}
                accessibilityLabel={button.label}
                style={({ pressed }) => [
                  styles.iconButton,
                  disabled ? styles.iconButtonDisabled : null,
                  pressed && !disabled ? styles.iconButtonPressed : null,
                ]}
                disabled={disabled}
                onPress={handlePress}
              >
                <Text style={styles.iconLabel}>{button.icon}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.canvasSection}>
          <View
            ref={canvasCaptureRef}
            collapsable={false}
            style={[
              styles.canvasShot,
              {
                width: canvasDimensions.width,
                height: canvasDimensions.height,
              },
            ]}
            onLayout={() => setViewShotLayoutReady(true)}
          >
            <View style={styles.canvas} collapsable={false}>
              <View style={styles.canvasBase} />
              {canvasBackgroundUri ? (
                <Image
                  source={{ uri: canvasBackgroundUri }}
                  style={styles.canvasImage}
                  onLoad={() => setCanvasBackgroundReady(true)}
                  onError={(event) => {
                    console.warn(
                      "Failed to load canvas background",
                      event?.nativeEvent ?? event
                    );
                    setCanvasBackgroundReady(false);
                    Alert.alert(
                      "שגיאה בטעינת הרקע",
                      "לא הצלחנו לטעון את התמונה. נסו לבחור תמונה אחרת."
                    );
                  }}
                />
              ) : null}
              {canvasBackgroundUri && !canvasBackgroundReady ? (
                <View style={styles.canvasLoadingOverlay}>
                  <ActivityIndicator color={colors.background} />
                </View>
              ) : null}
              <Pressable
                style={styles.canvasTouchOverlay}
                onPress={handleCanvasPress}
              />
              {texts.map((text) => (
                <DraggableText
                  key={text.id}
                  item={text}
                  selected={selectedTextId === text.id}
                  onSelect={(id) => {
                    setSelectedTextId(id);
                    setActiveTextPanel(null);
                  }}
                  onMove={handleMoveText}
                  onEdit={handleStartEditing}
                  onResize={handleResizeText}
                  canvasWidth={canvasDimensions.width}
                  canvasHeight={canvasDimensions.height}
                  showEditingChrome={showEditingChrome}
                  editing={editingTextId === text.id}
                  onChangeContent={handleChangeTextContent}
                  onFinishEditing={handleFinishEditing}
                />
              ))}
            </View>
          </View>
          {renderTextPanel()}
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={handleBackToLibrary}
          style={({ pressed }) => [
            styles.footerSecondaryButton,
            pressed ? styles.footerSecondaryButtonPressed : null,
          ]}
        >
          <Text style={styles.footerSecondaryLabel}>חזרה לבחירת רקע</Text>
        </Pressable>
        <PrimaryButton
          label="הרקע מוכן"
          onPress={handleSaveBackground}
          loading={saving}
          disabled={disableSaveAction}
        />
      </View>

      <Modal
        visible={showQuoteLibrary}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuoteLibrary(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>בחרו ציטוט</Text>
            {quotesLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <FlatList
                data={quotes}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => (
                  <QuoteCard
                    quote={item}
                    onSelect={() => handleAddQuote(item)}
                  />
                )}
              />
            )}
            <Pressable
              style={({ pressed }) => [
                styles.panelCloseButton,
                pressed ? styles.panelCloseButtonPressed : null,
              ]}
              onPress={() => setShowQuoteLibrary(false)}
            >
              <Text style={styles.panelCloseLabel}>סגירה</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={confirmExitVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>לעזוב ללא שמירה</Text>
            <Text style={styles.confirmMessage}>
              {"הרקע האישי לא יישמר. האם לחזור לבחירת הרקע?"}
            </Text>
            <PrimaryButton
              label="חזרה לבחירת הרקע"
              onPress={handleConfirmExit}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleCancelExit}
              style={({ pressed }) => [
                styles.confirmSecondaryButton,
                pressed ? styles.confirmSecondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.confirmSecondaryLabel}>המשך עריכה</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  editorRow: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  iconBar: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  iconBarLeft: {
    width: TEXT_ICON_BAR_WIDTH,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  iconButtonPressed: {
    opacity: 0.85,
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  iconLabel: {
    fontSize: 22,
  },
  canvasSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    gap: spacing.sm,
  },
  canvasShot: {
    borderRadius: spacing.xl,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: colors.divider,
  },
  canvas: {
    flex: 1,
  },
  canvasBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
  canvasImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: "cover",
  },
  canvasLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  canvasTouchOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  footer: {
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    gap: spacing.sm,
    marginBottom: 50,
  },
  footerSecondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  footerSecondaryButtonPressed: {
    opacity: 0.85,
  },
  footerSecondaryLabel: {
    color: colors.accent,
    fontWeight: "600",
  },
  floatingPanel: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    width: 240,
    maxHeight: 360,
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  fontPanel: {
    paddingBottom: spacing.md,
  },
  fontScroll: {
    maxHeight: 200,
  },
  fontScrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  panelOption: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  panelOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  panelOptionPressed: {
    opacity: 0.85,
  },
  panelOptionLabel: {
    color: colors.textPrimary,
    textAlign: "center",
  },
  fontWeightSection: {
    gap: spacing.xs,
  },
  fontWeightTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  fontWeightButtons: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    gap: spacing.sm,
  },
  fontWeightButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  fontWeightButtonPressed: {
    opacity: 0.85,
  },
  fontWeightButtonSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  fontWeightButtonLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  fontWeightButtonLabelSelected: {
    color: colors.accent,
  },
  panelCloseButton: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  panelCloseButtonPressed: {
    opacity: 0.85,
  },
  panelCloseLabel: {
    color: colors.accent,
    fontWeight: "600",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: colors.accent,
  },
  customColorSection: {
    width: "100%",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  customColorTitle: {
    textAlign: "center",
    color: colors.textPrimary,
    fontWeight: "600",
  },
  customColorPreview: {
    height: 48,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  customColorGradientContainer: {
    width: "100%",
    height: COLOR_GRADIENT_HEIGHT,
    borderRadius: COLOR_GRADIENT_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.divider,
    justifyContent: "center",
    position: "relative",
  },
  customColorGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  customColorThumb: {
    position: "absolute",
    top: (COLOR_GRADIENT_HEIGHT - COLOR_THUMB_SIZE) / 2,
    width: COLOR_THUMB_SIZE,
    height: COLOR_THUMB_SIZE,
    borderRadius: COLOR_THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.background,
  },
  customColorHex: {
    textAlign: "center",
    color: colors.textPrimary,
    fontWeight: "600",
    letterSpacing: 1,
  },
  rgbSection: {
    gap: spacing.xs,
  },
  rgbRow: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rgbInputGroup: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  rgbLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rgbInput: {
    width: 64,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: spacing.md,
    textAlign: "center",
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  fontControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  fontButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.card,
  },
  fontButtonPressed: {
    opacity: 0.85,
  },
  fontButtonLabel: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  fontSizeLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
    textAlign: "center",
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },
  draggableText: {
    position: "absolute",
    padding: spacing.xs,
    borderWidth: 1.5,
    borderRadius: spacing.sm,
  },
  draggableTextContent: {
    textAlign: "center",
  },
  resizeHandle: {
    position: "absolute",
    width: RESIZE_HANDLE_SIZE,
    height: RESIZE_HANDLE_SIZE,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  resizeHandleTop: {
    top: -RESIZE_HANDLE_OFFSET,
    left: "50%",
    marginLeft: -RESIZE_HANDLE_SIZE / 2,
  },
  resizeHandleBottom: {
    bottom: -RESIZE_HANDLE_OFFSET,
    left: "50%",
    marginLeft: -RESIZE_HANDLE_SIZE / 2,
  },
  resizeHandleLeft: {
    left: -RESIZE_HANDLE_OFFSET,
    top: "50%",
    marginTop: -RESIZE_HANDLE_SIZE / 2,
  },
  resizeHandleRight: {
    right: -RESIZE_HANDLE_OFFSET,
    top: "50%",
    marginTop: -RESIZE_HANDLE_SIZE / 2,
  },
  quoteCard: {
    padding: spacing.sm,
    borderRadius: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: spacing.sm,
  },
  quoteCardPressed: {
    opacity: 0.9,
  },
  quoteText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  quoteAuthor: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: "center",
  },
  confirmMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  confirmSecondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmSecondaryButtonPressed: {
    opacity: 0.85,
  },
  confirmSecondaryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.accent,
    textAlign: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  modalList: {
    paddingBottom: spacing.sm,
  },
  draggableTextInput: {
    padding: 0,
    backgroundColor: "transparent",
  },
});
