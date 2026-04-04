/**
 * Web fallback for @gorhom/bottom-sheet.
 * Provides a CSS slide-up drawer with backdrop instead of native bottom sheet.
 * Metro resolves `@gorhom/bottom-sheet` to this file when building for web.
 *
 * Design: simple translate + backdrop. No gesture physics. Good enough for beta.
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  type ReactNode,
} from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  type ViewProps,
  type TextInputProps,
} from "react-native";

/* ---------- Types ---------- */

type BottomSheetProps = ViewProps & {
  children: ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  enablePanDownToClose?: boolean;
  onChange?: (index: number) => void;
  onClose?: () => void;
  backgroundStyle?: object;
  handleIndicatorStyle?: object;
  backdropComponent?: React.ComponentType<BottomSheetBackdropProps>;
  style?: object;
};

export type BottomSheetBackdropProps = {
  animatedIndex: { value: number };
  animatedPosition: { value: number };
  style?: object;
  disappearsOnIndex?: number;
  appearsOnIndex?: number;
  opacity?: number;
};

/* ---------- BottomSheet (default export) ---------- */

export type BottomSheetRef = {
  snapToIndex: (index: number) => void;
  close: () => void;
  expand: () => void;
  collapse: () => void;
  forceClose: () => void;
};

const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(function BottomSheet(
  { children, snapPoints, index = -1, onChange, onClose, enablePanDownToClose, style, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(index >= 0);

  const open = useCallback(() => {
    setVisible(true);
    onChange?.(0);
  }, [onChange]);

  const close = useCallback(() => {
    setVisible(false);
    onChange?.(-1);
    onClose?.();
  }, [onChange, onClose]);

  useImperativeHandle(ref, () => ({
    snapToIndex: (i: number) => (i >= 0 ? open() : close()),
    close,
    expand: open,
    collapse: close,
    forceClose: close,
  }));

  if (!visible) return null;

  const height = snapPoints?.[0]
    ? typeof snapPoints[0] === "string"
      ? snapPoints[0]
      : `${snapPoints[0]}px`
    : "50%";

  return (
    <View style={webStyles.overlay}>
      <Pressable
        style={webStyles.backdrop}
        onPress={enablePanDownToClose ? close : undefined}
      />
      <View style={[webStyles.sheet, { height }, style]} {...rest}>
        <View style={webStyles.handleContainer}>
          <View style={webStyles.handle} />
        </View>
        {children}
      </View>
    </View>
  );
});

export default BottomSheet;

/* ---------- BottomSheetModalProvider ---------- */

export function BottomSheetModalProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ---------- BottomSheetBackdrop ---------- */

export function BottomSheetBackdrop({
  style,
  opacity = 0.4,
}: BottomSheetBackdropProps & { children?: ReactNode }) {
  return (
    <View
      style={[
        webStyles.backdrop,
        { backgroundColor: `rgba(0,0,0,${opacity})` },
        style,
      ]}
    />
  );
}

/* ---------- BottomSheetTextInput ---------- */

export const BottomSheetTextInput = forwardRef<TextInput, TextInputProps>(
  function BottomSheetTextInput(props, ref) {
    return <TextInput ref={ref} {...props} />;
  },
);

/* ---------- BottomSheetView ---------- */

export function BottomSheetView({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View style={[{ flex: 1 }, style]} {...rest}>
      {children}
    </View>
  );
}

/* ---------- BottomSheetScrollView ---------- */

export function BottomSheetScrollView({
  children,
  ...rest
}: { children: ReactNode } & ViewProps) {
  return <ScrollView {...rest}>{children}</ScrollView>;
}

/* ---------- BottomSheetFlatList (stub) ---------- */

export const BottomSheetFlatList = forwardRef(function BottomSheetFlatList(props: any, ref: any) {
  const { data, renderItem, keyExtractor, ...rest } = props;
  return (
    <ScrollView ref={ref} {...rest}>
      {data?.map((item: any, index: number) => (
        <View key={keyExtractor?.(item, index) ?? index}>
          {renderItem({ item, index, separators: {} })}
        </View>
      ))}
    </ScrollView>
  );
});

/* ---------- Styles ---------- */

const webStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    zIndex: 1001,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
  },
});
