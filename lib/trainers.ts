// Legacy shim — replaced by lib/staff.ts (generic for all business types)
// Re-exports kept for backward compatibility with old /api/client/trainers route.
export {
  getStaff as getTrainers,
  getActiveStaff as getActiveTrainers,
  getStaffById as getTrainerById,
  getStaffByPhoneAny as getTrainerByPhoneAny,
  upsertStaff as upsertTrainer,
  deleteStaff as deleteTrainer,
  updateStaffAvailability as updateTrainerAvailability,
  formatAvailabilityForBot,
  parseAvailabilityCommand,
  emptyAvailability,
  DAYS,
} from './staff';
