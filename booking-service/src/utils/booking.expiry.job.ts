import { CronRunner } from "../../../utils/src";
import { BookingService } from "../services/booking.service";

export class BookingExpiryJob {
  private readonly cronRunner: CronRunner;
  private readonly bookingService: BookingService;

  constructor({
    cronRunner,
    bookingService,
  }: {
    cronRunner: CronRunner;
    bookingService: BookingService;
  }) {
    this.cronRunner = cronRunner;
    this.bookingService = bookingService;
  }

  start() {
    this.cronRunner.schedule("Booking Expiry Cleanup", "* * * * *", async () => {
      await this.bookingService.expirePendingBookings();
    });
  }
}
