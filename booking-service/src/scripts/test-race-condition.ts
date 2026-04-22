import "reflect-metadata";
import { container } from "../container";
import { asValue } from "awilix";
import { BookingService } from "../services/booking.service";

async function runTest() {
  const eventId = "77777777-7777-7777-7777-777777777777";
  const seatId = "88888888-8888-8888-8888-888888888888";
  const userId1 = "11111111-1111-1111-1111-111111111111";
  const userId2 = "22222222-2222-2222-2222-222222222222";

  // 1. Mock External gRPC Dependencies
  const mockEventClient = {
    findEventsByIdsWithSeats: async () => ({
      events: [
        {
          id: eventId,
          name: "Test Race Condition Event",
          seats: [{ id: seatId, seatNumber: "R1", seatTier: 1 }],
        },
      ],
    }),
  };

  const mockPaymentClient = {
    findPaymentsByBookingIds: async () => ({ payments: [] }),
  };

  // Register mocks in the container
  container.register({
    eventServiceGrpcClient: asValue(mockEventClient),
    paymentServiceGrpcClient: asValue(mockPaymentClient),
  });

  const bookingService = container.resolve<BookingService>("bookingService");

  console.log("\n🚀 Starting Race Condition Test...");
  console.log(`Scenario: Two users attempting to book the same seat (${seatId}) simultaneously.`);

  const payload = {
    eventId,
    seats: [{ id: seatId, price: 150 }],
    totalAmount: 150,
  };

  // 2. Trigger concurrent requests
  const results = await Promise.allSettled([
    bookingService.create({ ...payload, userId: userId1 }),
    bookingService.create({ ...payload, userId: userId2 }),
  ]);

  // 3. Analyze results
  console.log("\n--- Results ---");
  results.forEach((res, idx) => {
    const user = idx === 0 ? "User Alpha" : "User Beta";
    if (res.status === "fulfilled") {
      console.log(`✅ ${user}: SUCCEEDED (Booking ID: ${res.value.id})`);
    } else {
      console.log(`❌ ${user}: FAILED - ${res.reason.message}`);
    }
  });

  const successCount = results.filter((r) => r.status === "fulfilled").length;
  const failureCount = results.filter((r) => r.status === "rejected").length;

  console.log("\n--- Summary ---");
  if (successCount === 1 && failureCount === 1) {
    console.log("✅ PASS: Distributed advisory locks prevented double-booking.");
  } else if (successCount > 1) {
    console.log("❌ FAIL: Double booking occurred! Race condition NOT handled.");
  } else {
    console.log("⚠️  Observation: Both requests failed or something else went wrong.");
  }

  process.exit(0);
}

runTest().catch((err) => {
  console.error("Fatal error during test:", err);
  process.exit(1);
});
