import { IBookingRepository } from "./../interface/IBooking.repository";
import { CronRunner, logger } from "../../../utils/src";
import { EventServiceGrpcClient } from "./../grpc/event.client";

export class BookingExpiryJob {
  private readonly cronRunner: CronRunner;
  private readonly bookingRepository: IBookingRepository;
  private readonly eventServiceGrpcClient: EventServiceGrpcClient;

  constructor({
    cronRunner,
    bookingRepository,
    eventServiceGrpcClient,
  }: {
    cronRunner: CronRunner;
    bookingRepository: IBookingRepository;
    eventServiceGrpcClient: EventServiceGrpcClient;
  }) {
    this.cronRunner = cronRunner;
    this.bookingRepository = bookingRepository;
    this.eventServiceGrpcClient = eventServiceGrpcClient;
  }

  start() {
    this.cronRunner.schedule("Booking Expiry Cleanup", "* * * * *", async () => {
      await this.expirePendingBookings();
    });
  }

  /**
   * Expires stale open bookings and releases their locked seats.
   * Used in: Booking expiry cleanup flow
   * Triggered via: Cron job
   */
  private async expirePendingBookings() {
    const expiredBookings = await this.bookingRepository.findExpiredPendingBookings();
    if (!expiredBookings.length) {
      return { affectedCount: 0 };
    }

    const bookingIds = expiredBookings.map((booking) => booking.id);
    await this.eventServiceGrpcClient.bulkReleaseSeats({ bookingIds });
    const affectedCount = await this.bookingRepository.bulkExpireBookings(bookingIds);

    logger.info(`Expired ${affectedCount} bookings`);
    return { affectedCount };
  }
}
