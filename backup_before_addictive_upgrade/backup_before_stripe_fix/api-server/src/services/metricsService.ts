export interface DailyMetrics {
  earningsPerTrip: number | null;
  earningsPerKm: number | null;
  earningsPerHour: number | null;
  rating: number | null;
}

export function calculateDailyMetrics(opts: {
  earnings: number;
  trips: number;
  kmDriven?: number | null;
  hoursWorked?: number | null;
  rating?: number | null;
}): DailyMetrics {
  const { earnings, trips, kmDriven, hoursWorked, rating } = opts;

  const earningsPerTrip = trips > 0 ? earnings / trips : null;
  const earningsPerKm = kmDriven && kmDriven > 0 ? earnings / kmDriven : null;
  const earningsPerHour = hoursWorked && hoursWorked > 0 ? earnings / hoursWorked : null;

  return {
    earningsPerTrip,
    earningsPerKm,
    earningsPerHour,
    rating: rating ?? null,
  };
}

export function aggregateMetrics(
  summaries: Array<{
    earnings: number;
    trips: number;
    kmDriven?: number | null;
    hoursWorked?: number | null;
    rating?: number | null;
  }>
): {
  totalEarnings: number;
  totalTrips: number;
  totalKm: number | null;
  totalHours: number | null;
  avgRating: number | null;
  earningsPerTrip: number | null;
  earningsPerKm: number | null;
  earningsPerHour: number | null;
} {
  if (summaries.length === 0) {
    return {
      totalEarnings: 0,
      totalTrips: 0,
      totalKm: null,
      totalHours: null,
      avgRating: null,
      earningsPerTrip: null,
      earningsPerKm: null,
      earningsPerHour: null,
    };
  }

  const totalEarnings = summaries.reduce((s, r) => s + r.earnings, 0);
  const totalTrips = summaries.reduce((s, r) => s + r.trips, 0);

  const kmValues = summaries.filter((r) => r.kmDriven != null && r.kmDriven > 0);
  const totalKm = kmValues.length > 0 ? kmValues.reduce((s, r) => s + (r.kmDriven ?? 0), 0) : null;

  const hrValues = summaries.filter((r) => r.hoursWorked != null && r.hoursWorked > 0);
  const totalHours = hrValues.length > 0 ? hrValues.reduce((s, r) => s + (r.hoursWorked ?? 0), 0) : null;

  const ratingValues = summaries.filter((r) => r.rating != null && r.rating > 0);
  const avgRating =
    ratingValues.length > 0
      ? ratingValues.reduce((s, r) => s + (r.rating ?? 0), 0) / ratingValues.length
      : null;

  const earningsPerTrip = totalTrips > 0 ? totalEarnings / totalTrips : null;
  const earningsPerKm = totalKm && totalKm > 0 ? totalEarnings / totalKm : null;
  const earningsPerHour = totalHours && totalHours > 0 ? totalEarnings / totalHours : null;

  return {
    totalEarnings,
    totalTrips,
    totalKm,
    totalHours,
    avgRating,
    earningsPerTrip,
    earningsPerKm,
    earningsPerHour,
  };
}
