/**
 * Route entry: /(app)/(home)/availability → "Min tilgjengelighet".
 * Delegates to AvailabilityScreen so the component is testable in isolation.
 */
import { AvailabilityScreen } from "@/components/availability/AvailabilityScreen";

export default function AvailabilityRoute() {
  return <AvailabilityScreen />;
}
