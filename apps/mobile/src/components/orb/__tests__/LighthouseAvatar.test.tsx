/**
 * LighthouseAvatar (native) unit tests.
 *
 * NOTE: describe.skip until preset-expo + @testing-library/react-native are
 * wired into apps/mobile (neither is installed today). The test spec is kept
 * as living documentation of the intended assertions.
 */

describe.skip("LighthouseAvatar (native) — enable after preset-expo is wired", () => {
  it("renders initials from name", () => {
    // const { getByText } = render(<LighthouseAvatar name="Linn Andersen" />);
    // expect(getByText('LA')).toBeTruthy();
  });

  it("renders ? fallback when no name", () => {
    // const { getByText } = render(<LighthouseAvatar />);
    // expect(getByText('?')).toBeTruthy();
  });
});
