/**
 * Orb (native) unit tests.
 *
 * NOTE: Mobile jest runs in a node environment WITHOUT the React Native
 * preset or @testing-library/react-native (neither is installed in
 * apps/mobile/package.json). Rendering native components is therefore not
 * possible from this file. The test spec is kept as living documentation
 * of the intended assertions so that when the test-infra gets upgraded
 * (preset-expo + @testing-library/react-native) the spec can be enabled
 * by removing the `describe.skip`.
 *
 * Reanimated mock is included for when the preset is added.
 */
jest.mock("react-native-reanimated", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("react-native-reanimated/mock"),
);

describe.skip("Orb (native) — enable after preset-expo is wired", () => {
  it("renders at default size 48", () => {
    // const { getByTestId } = render(
    //   <Orb testID="orb" accessibilityLabel="ticket status" />,
    // );
    // expect(getByTestId('orb').props.style).toEqual(
    //   expect.objectContaining({ width: 48, height: 48 })
    // );
  });

  it("renders accessibility label", () => {
    // const { getByLabelText } = render(
    //   <Orb testID="orb" accessibilityLabel="waiting" />,
    // );
    // expect(getByLabelText('waiting')).toBeTruthy();
  });

  it("renders check icon when withCheck=true", () => {
    // const { getByTestId } = render(
    //   <Orb testID="orb" withCheck accessibilityLabel="done" />,
    // );
    // expect(getByTestId('orb-check')).toBeTruthy();
  });

  it("does not run pulse animation when reduce-motion is on", () => {
    // mock useReducedMotion → true, render with pulse, assert shared values
    // remain at 1.
  });
});
